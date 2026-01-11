// Rota para buscar números já vendidos (bloqueio na tabela)
app.get('/api/rifa/ocupados', async (req, res) => {
    try {
        const db = client.db("seu_banco_de_dados"); // Substitua pelo nome do seu DB
        const ocupados = await db.collection("rifas")
            .find({ $or: [{ status: 'pago' }, { status: 'pendente' }] })
            .toArray();
        res.json(ocupados.map(doc => doc.milhar));
    } catch (err) {
        res.status(500).json([]);
    }
});

// Rota para gerar o PIX e salvar a reserva no MongoDB
app.post('/api/gerar-pix', async (req, res) => {
    const { valor, numeros } = req.body;
    try {
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            },
            body: JSON.stringify({
                transaction_amount: parseFloat(valor),
                description: `Rifa Milhar: ${numeros}`,
                payment_method_id: 'pix',
                payer: { email: 'comprador@rifa.com' }
            })
        });

        const data = await response.json();

        if (data.point_of_interaction) {
            const db = client.db("seu_banco_de_dados");
            const milharArray = numeros.split(',');
            
            // Grava a reserva no MongoDB
            await db.collection("rifas").insertMany(milharArray.map(n => ({
                milhar: n,
                status: 'pendente',
                pagamentoId: data.id,
                createdAt: new Date()
            })));
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
});
