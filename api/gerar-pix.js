export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { valor, descricao, numeros } = req.body;

    try {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'X-Idempotency-Key': Date.now().toString()
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: `Rifa Milhar: ${numeros}`,
                payment_method_id: "pix",
                payer: { email: "comprador@email.com" }
            })
        });

        const data = await response.json();
        
        // Aqui, se o data.status for 'pending', você pode salvar os 'numeros' no MongoDB como 'reservados'
        
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Erro no servidor' });
    }
}

