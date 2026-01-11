// Rota para buscar números ocupados (milhar)
app.get('/api/rifa/ocupados', async (req, res) => {
    try {
        const db = client.db("seu_banco_de_dados"); // Use o nome do seu banco do Bingo
        const ocupados = await db.collection("rifas").find({ status: 'pago' }).toArray();
        const listaNumeros = ocupados.map(doc => doc.milhar);
        res.json(listaNumeros);
    } catch (err) {
        res.status(500).json([]);
    }
});

// Rota para gerar pagamento e reservar milhar
app.post('/api/gerar-pix', async (req, res) => {
    const { valor, numeros } = req.body;
    try {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: `Rifa Milhar: ${numeros}`,
                payment_method_id: 'pix',
                payer: { email: 'pagador@rifa.com' }
            })
        });
        const data = await response.json();

        // Se o PIX foi gerado, salvamos como pendente no banco
        if (data.point_of_interaction) {
            const db = client.db("seu_banco_de_dados");
            const milharArray = numeros.split(',');
            await db.collection("rifas").insertMany(milharArray.map(n => ({
                milhar: n,
                status: 'pendente',
                pagamentoId: data.id,
                createdAt: new Date()
            })));
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao processar' });
    }
});
