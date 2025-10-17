// server.js
import express from 'express';
import fetch from 'node-fetch'; // لو Node18+ تقدر تستخدم global fetch
import crypto from 'crypto';

const app = express();
app.use(express.json());

// اقرأ هذي المتغيرات من environment
const SHOP_DOMAIN = process.env.https://nfsstore.online/; // e.g. your-store.myshopify.com
const SHOP_TOKEN = process.env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.; // shpat_xxx...
const PORT = process.env.PORT || 3000;

if (!SHOP_DOMAIN || !SHOP_TOKEN) {
  console.error('Missing SHOP_DOMAIN or SHOPIFY_ADMIN_TOKEN env vars');
  process.exit(1);
}

// Simple in-memory idempotency cache (for demo). In production استخدم cache persistent (Redis).
const recentHashes = new Map();

function makeHash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

app.post('/create-order', async (req, res) => {
  try {
    const {
      customer_name,
      phone,
      state,
      municipality,
      variant_id,
      quantity = 1,
      shipping_fee = 0,
      product_handle,
      meta_pixel_id
    } = req.body;

    if (!customer_name || !phone || !variant_id) {
      return res.status(400).json({ message: 'payload incomplete' });
    }

    // Idempotency: hash phone+variant+qty+timestamp-window (60s) to avoid dups
    const idHash = makeHash({ phone, variant_id, quantity, product_handle, municipality });
    if (recentHashes.has(idHash)) {
      return res.status(200).json({ message: 'duplicate', info: 'order recently created', order_reference: recentHashes.get(idHash) });
    }

    // split name
    const nameParts = customer_name.trim().split(' ');
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ') || '';

    // build order object
    const orderPayload = {
      order: {
        line_items: [
          {
            variant_id: Number(variant_id),
            quantity: Number(quantity),
            properties: {
              lead_name: customer_name,
              lead_phone: phone,
              lead_state: state,
              lead_municipality: municipality,
              from_widget: 'lead-cod-widget'
            }
          }
        ],
        shipping_lines: [
          {
            title: "توصيل - الدفع عند الاستلام",
            price: String(Number(shipping_fee) || 0),
            code: "COD"
          }
        ],
        billing_address: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          address1: municipality || '',
          city: state || '',
          country: "Algeria"
        },
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          address1: municipality || '',
          city: state || '',
          country: "Algeria"
        },
        email: null,
        financial_status: "pending",
        transactions: [],
        note: `Lead COD — widget. Tel: ${phone}`,
        payment_gateway_names: ["Cash on Delivery"],
        tags: "lead_form,cod"
      }
    };

    const url = `https://${SHOP_DOMAIN}/admin/api/2024-10/orders.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOP_TOKEN
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Shopify API error', data);
      return res.status(500).json({ message: 'Shopify API error', details: data });
    }

    const order = data.order;
    // save idempotency short-term
    recentHashes.set(idHash, order.order_number || order.id);
    setTimeout(()=> recentHashes.delete(idHash), 60 * 1000); // keep 60s

    return res.json({
      success: true,
      id: order.id,
      order_number: order.order_number,
      total: order.total_price,
      currency: order.currency
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error', error: err.message });
  }
});

app.get('/', (req,res) => res.send('OK - Lead COD Endpoint'));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
