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

    console.log("--- NEW REQUEST ---");
    console.log("Received Variant ID:", product_variant_id);

    if (!product_variant_id || !customer_name || !customer_phone || !shipping_address) {
      return res.status(400).json({ success: false, message: 'Missing data.' });
    }
    
    const orderPayload = {
      order: {
        source_name: "web",
        line_items: [{ 
          variant_id: parseInt(product_variant_id), 
          quantity: 1 
        }],
        customer: {
          first_name: customer_name,
          last_name: "(COD Form)"
        },
        phone: customer_phone, // وضع رقم الهاتف على مستوى الطلب مهم
        shipping_address: {
          address1: shipping_address,
          first_name: customer_name,
          last_name: "(COD Form)",
          country: "Algeria" // تأكد من صحة البلد
        },
        financial_status: 'pending',
        note: `تم الطلب من فورم COD. العنوان: ${shipping_address}`
      }
    };

    console.log("Sending payload to Shopify...");
    
    const orderResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();
    
    console.log("--- SHOPIFY RESPONSE ---");
    console.log("STATUS:", orderResponse.status);
    console.log("BODY:", JSON.stringify(orderData, null, 2));
    console.log("------------------------");

    if (!orderResponse.ok) {
      throw new Error(`Shopify rejected order creation with status ${orderResponse.status}.`);
    }

    if (!orderData.order || !orderData.order.id) {
        throw new Error("Shopify returned a success status but no order object was found.");
    }

    console.log(`Successfully created order ${orderData.order.name}.`);
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
