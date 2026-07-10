const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

let ordersStore = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.json({ orders: ordersStore });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, customerEmail, customerName, customerPhone, orderId } = req.body;

    const orderData = {
      id: orderId,
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      items: items || [],
      total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.07,
      status: 'pending',
      timestamp: new Date().toISOString(),
      paymentStatus: 'pending',
    };
    
    ordersStore.unshift(orderData);
    if (ordersStore.length > 100) {
      ordersStore = ordersStore.slice(0, 100);
    }

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `https://kpcurbankoreanfood.com/?payment=success&order=${orderId}`,
      cancel_url: `https://kpcurbankoreanfood.com/`,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
      },
    });

    const orderIndex = ordersStore.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      ordersStore[orderIndex].paymentStatus = 'processing';
    }

    res.json({ url: session.url, orderId: orderId });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
};
