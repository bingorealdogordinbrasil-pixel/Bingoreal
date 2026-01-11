// Rota para Gerar PIX da Rifa e salvar no MongoDB
app.post('/api/rifa/pagar', async (req, res) => {
    const { valor, numeros, email } = req.body; // numeros é um array ex: [1234, 5566]

    try {
        // 1. Criar o pagamento no Mercado Pago
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: `Rifa Milhar: ${numeros.join(', ')}`,
                payment_method_id: 'pix',
                payer: { email: email || 'cliente@rifa.com' }
            })
        });

        const data = await mpResponse.json();

        // 2. Se o PIX foi gerado, salvar os números no MongoDB
        if (data.status === 'pending') {
            const db = client.db("seu_banco_de_dados"); // Use a mesma config do seu Bingo
            await db.collection("rifas").insertMany(numeros.map(n => ({
                milhar: n.toString().padStart(4, '0'),
                pagamentoId: data.id,
                status: 'pendente',
                dataCriacao: new Date()
            })));
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
