const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM O BANCO DE DADOS (bingo_db)
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoURI)
    .then(() => console.log("Servidor de Bingo e Banco de Dados Online!"))
    .catch(err => console.error("Erro ao conectar no MongoDB:", err));

// 2. CONFIGURAÇÃO MERCADO PAGO (Usando variável de ambiente para segurança)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// 3. MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// 4. ESTADO DO JOGO
let jogo = {
    bolas: [],
    fase: "acumulando", 
    premioAcumulado: 0,
    tempoSegundos: 300 
};

// 5. MOTOR AUTOMÁTICO DO BINGO
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            sortearBolaAutomatica();
        }
        jogo.tempoSegundos--;
    }
}, 1000);

function sortearBolaAutomatica() {
    let bola;
    if (jogo.bolas.length >= 50) return;
    do {
        bola = Math.floor(Math.random() * 50) + 1;
    } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
}

// --- ROTAS PARA O FRONTEND ---

// Faz o link do Render abrir o seu index.html automaticamente
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

// Cria usuário automaticamente (Necessário para o novo HTML funcionar)
app.post('/criar-usuario', async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email });
        if (!user) user = await User.create(req.body);
        res.json(user);
    } catch (e) { res.status(500).json(e); }
});

// GERAÇÃO DE PIX REAL
app.post('/gerar-pix', async (req, res) => {
    const { valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Deposito Bingo Real',
                payment_method_id: 'pix',
                payer: { email: 'comprador@bingoreal.com' },
                metadata: { user_id: userId }
            }
        });
        res.json(response.point_of_interaction.transaction_data);
    } catch (e) { res.status(500).json(e); }
});

// COMPRA DE CARTELAS
app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    if (jogo.fase !== "acumulando") return res.status(400).json({ message: "Sorteio em andamento" });

    const precoTotal = quantidade * 2;
    const user = await User.findById(usuarioId);

    if (user && user.saldo >= precoTotal) {
        let novasCartelas = [];
        for (let i = 0; i < quantidade; i++) {
            let nums = [];
            while (nums.length < 15) {
                let n = Math.floor(Math.random() * 50) + 1;
                if (!nums.includes(n)) nums.push(n);
            }
            nums.sort((a, b) => a - b);
            novasCartelas.push(nums);
        }

        await User.findByIdAndUpdate(usuarioId, {
            $inc: { saldo: -precoTotal },
            $push: { cartelas: { $each: novasCartelas } }
        });

        jogo.premioAcumulado += (precoTotal * 0.7);
        res.json({ success: true });
    } else {
        res.status(400).json({ message: "Saldo insuficiente" });
    }
});

// WEBHOOK PARA RECEBER PAGAMENTO AUTOMÁTICO
app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") {
                const userId = p.metadata.user_id;
                const valor = p.transaction_amount;
                await User.findByIdAndUpdate(userId, { $inc: { saldo: valor } });
                console.log(`Saldo de R$ ${valor} adicionado ao usuario ${userId}`);
            }
        } catch (e) { console.error("Erro Webhook:", e); }
    }
    res.status(200).send();
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando na porta " + PORT));
