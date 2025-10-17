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

    if (!product_variant_id) {
      return res.status(400).json({ success: false, message: 'Missing product variant ID.' });
    }
    
    const draftOrderPayload = {
      draft_order: {
        line_items: [{ 
          variant_id: product_variant_id, 
          quantity: 1 
        }],
        note: `Customer Address: ${shipping_address}`,
        customer: {
          first_name: customer_name || "Guest",
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

    // This is the most important part. We will now log everything.
    const responseStatus = draftResponse.status;
    const responseData = await draftResponse.json();

    console.log("--- SHOPIFY API RESPONSE ---");
    console.log("STATUS:", responseStatus);
    console.log("BODY:", JSON.stringify(responseData, null, 2));
    console.log("----------------------------");

    // We will check the response manually to find the error.
    if (responseStatus >= 400) {
        throw new Error(`Shopify returned an error status: ${responseStatus}`);
    }

    // If we get this far, it means the draft order was created.
    // For this test, we will not complete the order yet.
    res.status(200).json({ success: true, message: "Draft order created successfully. Check your Drafts folder in Shopify." });

  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
