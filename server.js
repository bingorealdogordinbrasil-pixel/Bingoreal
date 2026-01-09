const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Para chamar a API do Mercado Pago

const app = express();
app.use(cors());
app.use(express.json());

// CONEXÃO MONGO
const mongoURI = "mongodb+srv://admin:GQ81qipKL3o2Lpoa@cluster0.mongodb.net/bingoReal?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ Servidor e Banco Online!"));

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhadores: [] };

// --- ROTA PARA GERAR PIX REAL ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;

    try {
        // Integração com Mercado Pago (Exemplo de chamada de API)
        // Você precisará do seu Access Token do Mercado Pago
        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: parseFloat(valor),
            description: `Depósito Bingo Real - ID ${userId}`,
            payment_method_id: 'pix',
            payer: {
                email: 'pagador@exemplo.com',
                first_name: 'Jogador',
                last_name: 'Bingo'
            }
        }, {
            headers: {
                'Authorization': `Bearer SEU_ACCESS_TOKEN_AQUI`, // Coloque seu Token aqui
                'X-Idempotency-Key': Math.random().toString()
            }
        });

        const data = response.data;
        
        // Retorna o QR Code em Base64 e o código Copia e Cola
        res.json({
            qr_code: data.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("Erro ao gerar PIX:", error.response?.data || error.message);
        res.status(500).json({ error: "Falha ao gerar pagamento" });
    }
});

// ... (Mantenha as outras rotas /game-status, /comprar-com-saldo, etc.)

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
