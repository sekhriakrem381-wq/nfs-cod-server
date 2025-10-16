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
    
    const orderPayload = {
      order: {
        line_items: [{ 
          variant_id: product_variant_id, 
          quantity: 1 
        }],
        customer: {
          first_name: customer_name,
          last_name: "(COD Form)",
          phone: customer_phone
        },
        shipping_address: {
          address1: shipping_address,
          phone: customer_phone,
          first_name: customer_name,
          last_name: "(COD Form)",
          country: "Algeria" // تأكد من أن هذا هو بلدك
        },
        financial_status: 'pending',
        gateway: 'Cash on Delivery (COD)',
        note: `تم الطلب من فورم COD. العنوان: ${shipping_address}`,
        tags: "COD, Custom Form"
      }
    };
    
    const orderResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();

    // --== هذا هو الكود الجديد والمهم لتسجيل كل شيء ==--
    console.log("--- FULL SHOPIFY RESPONSE ---");
    console.log(`Response Status: ${orderResponse.status}`);
    console.log("Response Body:", JSON.stringify(orderData, null, 2));
    console.log("-----------------------------");
    // --== نهاية كود التسجيل ==--

    if (!orderResponse.ok) {
      throw new Error('Shopify API returned a non-OK status. Check the logs above for the full response from Shopify.');
    }
    
    if (!orderData.order || !orderData.order.name) {
        throw new Error("Shopify returned OK status, but the response did not contain the expected order object.");
    }

    console.log(`Order ${orderData.order.name} created successfully.`);
    res.status(200).json({ success: true, order: orderData.order });

  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
