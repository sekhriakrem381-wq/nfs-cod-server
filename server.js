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
          country: "Algeria"
        },
        financial_status: 'pending',
        gateway: 'Cash on Delivery (COD)',
        note: `تم الطلب من فورم COD. العنوان: ${shipping_address}`,
        tags: "COD, Custom Form",
        inventory_behaviour: 'decrement_obeying_policy'
      }
    };
    
    const orderResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('SHOPIFY ERROR:', JSON.stringify(orderData, null, 2));
      throw new Error('Shopify API returned an error.');
    }
    
    // --== الإصلاح الذكي للتعامل مع الاستجابة كقائمة أو كائن ==--
    let createdOrder;
    if (orderData.order) {
        // الحالة الطبيعية
        createdOrder = orderData.order;
    } else if (orderData.orders && orderData.orders.length > 0) {
        // الحالة الغريبة التي حدثت معك (قائمة)
        console.log("Shopify returned a list of orders, taking the first one.");
        createdOrder = orderData.orders[0];
    }

    if (!createdOrder) {
        console.error("Could not find the created order in Shopify's response:", JSON.stringify(orderData, null, 2));
        throw new Error("Invalid response structure from Shopify.");
    }
    // --== نهاية الإصلاح ==--

    console.log(`Order ${createdOrder.name} created successfully.`);
    res.status(200).json({ success: true, order: createdOrder });

  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
