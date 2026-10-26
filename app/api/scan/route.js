import { AREA_CATEGORIES } from '@/lib/helpers';
import { getClient, MODEL, parseJson, replyText, imageBlock, documentBlock, noKeyResponse, failResponse } from '@/lib/ai';

export const maxDuration = 60;

const FOOD_RULES = `Return JSON only, in this shape:
{"items":[{"name":"Chorizo","qty":"Half a ring","area":"Fridge","category":"Meat & fish","shelfDays":5,"status":null}]}

Rules:
- One entry per distinct food. Use short, everyday British names of three words or fewer (coriander, not cilantro; "Greek yoghurt", not "Greek style natural yoghurt 500g"). Leave out brands and pack sizes.
- "qty" is a short, friendly amount: "2 tins", "Half a bag", "About 200g", "6".
- "area" is one of: "Fridge", "Freezer", "Cupboards", "Spice rack", "Fresh herbs", "Drinks", "Wine", "Spirits", "Cleaning", "Washing machine", "Dishwasher".
  File each item by WHAT IT IS, not where you happened to see it. The app remembers it was in the fridge.
  Fresh herbs (basil, coriander, parsley, herb pots) always go in "Fresh herbs".
  Non-alcoholic drinks and mixers (juice, squash, fizzy drinks, sparkling or still water, tonic, tea, coffee, alcohol-free beer or wine) go in "Drinks". Milk stays in "Fridge".
  Wine, beer and cider go in "Wine". Spirits and liqueurs (gin, vodka, whisky, rum, Aperol, Baileys) go in "Spirits".
  Household products are not food but are tracked too: cleaning products, cloths, bin bags and foil go in "Cleaning"; laundry detergent, fabric conditioner and stain removers go in "Washing machine"; dishwasher tablets, rinse aid and salt go in "Dishwasher".
  Fruit used for drinks, like lemons and limes, stays in "Fridge".
- "category" groups similar things together. Pick one from the list for that area:
  Fridge: ${AREA_CATEGORIES.Fridge.join(', ')}
  Cupboards: ${AREA_CATEGORIES.Cupboards.join(', ')}
  Fresh herbs: ${AREA_CATEGORIES['Fresh herbs'].join(', ')}
  Spice rack: ${AREA_CATEGORIES['Spice rack'].join(', ')}
  Freezer: ${AREA_CATEGORIES.Freezer.join(', ')}
  Drinks: ${AREA_CATEGORIES.Drinks.join(', ')}
  Wine: ${AREA_CATEGORIES.Wine.join(', ')}
  Spirits: ${AREA_CATEGORIES.Spirits.join(', ')}
  Cleaning: ${AREA_CATEGORIES.Cleaning.join(', ')}
  Washing machine: ${AREA_CATEGORIES['Washing machine'].join(', ')}
  Dishwasher: ${AREA_CATEGORIES.Dishwasher.join(', ')}
- "shelfDays" is your best estimate of how many days from today it should be eaten by, for fresh or opened food. Use null for long-life things (tins, dried pasta, rice, spices, frozen food, unopened drinks and wine). An opened bottle of wine is about 3 days; opened juice about 5.
- For wine, put the grape or style in the name when you can see it (e.g. "Rioja", "Sauvignon blanc", "Prosecco"), and "qty" like "1 bottle" or "Half a bottle (open)". For spirits, give a rough amount left, e.g. "About 50ml" or "Half a bottle".
- For spices and dried herbs use "status": "Got it", "Low" or "Out". Otherwise "status" is null, unless the person says something is running low ("Low") or finished ("Out").
- What the person says is the best guide to amounts and condition. Use the pictures to spot things they didn't mention.
- For household products, "shelfDays" is null; use "status" "Low" if it looks nearly empty or they say so, "Out" if finished. "qty" like "1 bottle", "About 20 tablets", "Half a box".
- Ignore anything that is neither food, drink nor one of those household products (people, pets, toiletries, empty packaging).
- If you can't see or hear anything useful, return {"items":[]}.`;

const KIT_RULES = `Return JSON only, in this shape:
{"items":[{"name":"Slow cooker","note":"About 6 litres","category":"Appliances"}]}

Rules:
- List cooking equipment and appliances: oven, hob, microwave, air fryer, slow cooker, pans, wok, baking trays, blender and so on.
- "category" is one of: ${AREA_CATEGORIES.Equipment.join(', ')}.
- "name" is three words or fewer.
- "note" is a short useful detail (size, how many, or a quirk the person mentions, e.g. "Runs hot on the left").
- If you can't see or hear anything useful, return {"items":[]}.`;

export async function POST(req) {
  const client = getClient();
  if (!client) return noKeyResponse();

  try {
    const body = await req.json();
    const area = body.area || 'Auto';
    const note = (body.note || '').slice(0, 4000);
    const images = (body.images || []).slice(0, 10).map(imageBlock).filter(Boolean);
    const docs = (body.docs || []).slice(0, 2).map(documentBlock).filter(Boolean);
    const isKit = area === 'Equipment';
    const isReceipt = area === 'Receipt';

    if (!note.trim() && images.length === 0 && docs.length === 0) return Response.json({ items: [] });

    const receiptHelp = isReceipt
      ? `\n\nThis is a supermarket receipt or an online grocery order (Tesco, Sainsbury\u2019s, Asda, Aldi, Lidl, Morrisons, Waitrose, Ocado and so on), bought today.
- Turn shortened receipt names into plain food names (e.g. "TSCO FF CHKN THGH 1KG" is "Chicken thighs", qty "1kg").
- Use the quantity on the line (e.g. "2 x" means 2).
- Put each item in the area for what it is (frozen food in Freezer, fresh herbs in Fresh herbs, soft drinks and mixers in Drinks, wine and beer in Wine, spirits in Spirits).
- Estimate "shelfDays" from today for fresh food as if just bought (e.g. fresh chicken 2\u20133, milk 7, bagged salad 4, carrots 14).
- Include cleaning, laundry and dishwasher products in their areas. Skip toiletries, nappies, carrier bags, totals, savings, Clubcard or Nectar lines, and unavailable items.`
      : '';

    const spiceHelp =
      area === 'Spice rack'
        ? '\n\nThese are spice jars and packets. Read every label you can, including brand labels (e.g. Schwartz, supermarket own-brand). List each spice or dried herb separately. If a jar is clearly nearly empty, mark it "Low". Skip a jar only if you genuinely can\u2019t read it.'
        : '';

    const drinksHelp =
      area === 'Drinks' || area === 'Wine' || area === 'Spirits'
        ? '\n\nThis is their drinks: soft drinks, mixers, juice and squash go in "Drinks"; wine, beer and cider go in "Wine"; spirits and liqueurs go in "Spirits". Read bottle labels where you can.'
        : area === 'Fresh herbs'
        ? '\n\nThese are fresh herbs, cut or growing in pots. Put them all in "Fresh herbs".'
        : '';

    const productHelp = ['Cleaning', 'Washing machine', 'Dishwasher'].includes(area)
      ? `\n\nThese are household products in their ${area.toLowerCase()} area. Read the labels (e.g. Fairy, Finish, Persil, Lenor, Dettol). Put each in "Cleaning", "Washing machine" or "Dishwasher" as fits, and say how much is left.`
      : '';

    const where = isKit
      ? 'The person is showing you their kitchen equipment.'
      : isReceipt
      ? 'The person is showing you a shopping receipt or order.'
      : area === 'Auto'
      ? 'The person is adding things they missed. Work out which area each item belongs in.'
      : `The person is showing you their ${area.toLowerCase()}. Put items in "${area}" unless they clearly belong elsewhere.`;
    // Receipts and photos can include household products, so the person is told what was found either way.

    const content = [
      ...docs,
      ...images,
      {
        type: 'text',
        text: `${where}${spiceHelp}${drinksHelp}${productHelp}${receiptHelp}\n\n${images.length || docs.length ? `There are ${images.length + docs.length} picture(s) or file(s) above.` : 'There are no pictures.'}\n\nWhat they said or typed:\n"""${note || '(nothing)'}"""\n\n${isKit ? KIT_RULES : FOOD_RULES}`,
      },
    ];

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system:
        'You are the stock-taking assistant inside Yes Chef!, a UK kitchen app for busy families. You turn quick videos, photos and spoken notes into a tidy stock list of food, drink and household products. Be accurate and never invent items you have no evidence for.',
      messages: [{ role: 'user', content }],
    });

    const data = parseJson(replyText(msg));
    const items = Array.isArray(data.items) ? data.items : [];
    return Response.json({ items, kind: isKit ? 'kit' : 'food' });
  } catch (e) {
    return failResponse(e);
  }
}
