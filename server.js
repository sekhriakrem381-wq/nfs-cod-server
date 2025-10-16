const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.post('/create-order', async (req, res) => {
  try {
    const { product_variant_id, customer_name, customer_phone, shipping_address } = req.body;

    if (!product_variant_id || !customer_name || !customer_phone || !shipping_address) {
      return res.status(400).json({ success: false, message: 'Missing data.' });
    }
    
    const draftOrderPayload = {
      draft_order: {
        line_items: [{ 
          variant_id: parseInt(product_variant_id), 
          quantity: 1 
        }],
        note: `عنوان الزبون: ${shipping_address}`,
        customer: {
          first_name: customer_name,
          last_name: "(COD Form)",
          phone: customer_phone
        }
      }
    };
    
    const draftResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify(draftOrderPayload)
    });

    const draftData = await draftResponse.json();

    if (!draftResponse.ok) {
      console.error('SHOPIFY ERROR:', JSON.stringify(draftData, null, 2));
      throw new Error('Shopify API returned an error.');
    }
    
    // --== الإصلاح الذكي للتعامل مع الاستجابة كقائمة أو كائن ==--
    let createdDraft;
    if (draftData.draft_order) {
        // الحالة الطبيعية
        createdDraft = draftData.draft_order;
    } else if (draftData.draft_orders && draftData.draft_orders.length > 0) {
        // الحالة الغريبة التي حدثت معك (قائمة). نأخذ أول عنصر لأنه الأحدث.
        console.log("Shopify returned a list of drafts, taking the first one.");
        createdDraft = draftData.draft_orders[0];
    }

    if (!createdDraft || !createdDraft.id) {
        console.error("Could not find the created draft in Shopify's response:", JSON.stringify(draftData, null, 2));
        throw new Error("Invalid response structure from Shopify.");
    }
    // --== نهاية الإصلاح ==--

    const draftOrderId = createdDraft.id;
    console.log(`Draft Order ${draftOrderId} identified. Completing...`);

    // --- إكمال الطلب المبدئي ---
    const completeResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders/${draftOrderId}/complete.json?payment_pending=true`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
    });

    const completeData = await completeResponse.json();
    if (!completeResponse.ok) {
      console.error('DRAFT COMPLETION ERROR:', JSON.stringify(completeData, null, 2));
      throw new Error('Failed to complete draft order.');
    }
    
    console.log(`Order ${completeData.draft_order.order_id} created successfully.`);
    res.status(200).json({ success: true, order_id: completeData.draft_order.order_id });

  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
