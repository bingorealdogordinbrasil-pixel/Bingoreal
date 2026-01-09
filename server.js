const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Necessário para gerar o PIX

const app = express();
app.use(cors());
app.use(express.json());

// CONEXÃO MONGO (Com sua senha: GQ81qipKL3o2Lpoa)
const mongoURI = "mongodb+srv://admin:GQ81qipKL3o2Lpoa@cluster0.mongodb.net/bingoReal?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Banco de Dados Conectado!"))
    .catch((err) => console.error("❌ Erro Mongo:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhadores: [] };

// --- ROTA PARA GERAR QR CODE PIX ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    
    try {
        // Substitua 'SEU_ACCESS_TOKEN' pelo seu Token do Mercado Pago
        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: parseFloat(valor),
            description: `Depósito Bingo - ID ${userId}`,
            payment_method_id: 'pix',
            payer: { email: 'contato@bingoreal.com' }
        }, {
            headers: { 
                'Authorization': `Bearer SEU_ACCESS_TOKEN_AQUI`,
                'X-Idempotency-Key': Math.random().toString() 
            }
        });

        res.json({
            qr_code: response.data.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.data.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) {
        res.status(500).json({ error: "Erro ao gerar PIX" });
    }
});

// MOTOR DO JOGO E OUTRAS ROTAS (Mantenha o restante como enviado anteriormente)
// ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor ativo na porta " + PORT));
