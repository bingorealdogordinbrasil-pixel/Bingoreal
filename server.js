const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONEXÃO COM O BANCO DE DADOS ---
// Usando seu usuário admin e a senha bingo123
const mongoURI = "mongodb+srv://admin:bingo123@cluster0.mongodb.net/bingoReal?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Banco Conectado!"))
    .catch((err) => console.error("❌ Erro ao conectar banco:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: String,
    saldo: { type: Number, default: 0 }, cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhadores: [] };

// --- ROTA PARA GERAR QR CODE PIX ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        // AQUI VAI O SEU ACCESS TOKEN DO MERCADO PAGO
        const MP_TOKEN = "TEST-4712079083236357-010820-2c7b5f3d4e..."; 

        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: parseFloat(valor),
            description: `Crédito Bingo - ID ${userId}`,
            payment_method_id: 'pix',
            payer: { email: 'contato@seusite.com' }
        }, {
            headers: { 'Authorization': `Bearer ${MP_TOKEN}` }
        });

        res.json({
            qr_code: response.data.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.data.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) {
        res.status(500).json({ error: "Erro ao gerar PIX" });
    }
});

// MOTOR DO JOGO (Sorteio Automático)
setInterval(async () => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0) && jogo.ganhadores.length === 0) {
            let bola = Math.floor(Math.random() * 50) + 1;
            while(jogo.bolas.includes(bola)) { bola = Math.floor(Math.random() * 50) + 1; }
            jogo.bolas.push(bola);
            // Lógica de verificação de ganhador aqui...
        }
        jogo.tempoSegundos--;
    }
}, 1000);

// ROTAS DE STATUS
app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor rodando!"));
