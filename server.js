const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();

// CONFIGURAÇÕES INICIAIS
app.use(cors());
app.use(express.json());

// --- ESSA PARTE RESOLVE O ERRO NOT FOUND ---
// Serve os arquivos da pasta raiz (onde está o index.html)
app.use(express.static(path.join(__dirname, "")));

// CONFIGURAÇÃO MERCADO PAGO
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// CONEXÃO MONGODB (Usando a sua variável do Render)
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("Bingo Conectado ao MongoDB!"))
    .catch(err => console.error("Erro MongoDB:", err));

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ROTA PARA ABRIR O SITE (Obrigatória para não dar Not Found)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// MOTOR DO BINGO (Simplificado para o exemplo)
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };

// ROTA DE STATUS DO JOGO
app.get('/game-status', (req, res) => res.json(jogo));

// ROTA DE DADOS DO USUÁRIO
app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

// ROTA DE PAGAMENTO PIX
app.post('/gerar-pix', async (req, res) => {
    const { email, valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Créditos Bingo Real',
                payment_method_id: 'pix',
                payer: { email: email || 'test@test.com' },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json(e); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
