const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- MERCADO PAGO ---
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});
const payment = new Payment(client);

// --- BANCO DE DADOS ---
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongoURI);

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, senha: String,
    saldo: { type: Number, default: 0 }, cartelas: { type: Array, default: [] }
}));

// --- MOTOR DO JOGO ---
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhador: null };

setInterval(async () => {
    if (jogo.fase === "acumulando") {
        if (jogo.tempoSegundos > 0) {
            jogo.tempoSegundos--;
        } else {
            jogo.fase = "sorteio";
        }
    } else if (jogo.fase === "sorteio") {
        // Sorteia uma bola a cada 10 segundos (tempo negativo para controle)
        if (Math.abs(jogo.tempoSegundos) % 10 === 0) {
            await realizarSorteio();
        }
        jogo.tempoSegundos--;
    } else if (jogo.fase === "finalizado") {
        // Aguarda 15 segundos exibindo o ganhador e reinicia
        if (Math.abs(jogo.tempoSegundos) % 15 === 0) {
            reiniciarGlobal();
        }
        jogo.tempoSegundos--;
    }
}, 1000);

async function realizarSorteio() {
    if (jogo.bolas.length >= 50) {
        reiniciarGlobal(); // Ninguém ganhou até a bola 50, reseta.
        return;
    }

    let bola;
    do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);

    // Verificar se alguém completou a cartela
    const todosUsuarios = await User.find({ "cartelas.0": { $exists: true } });
    for (let u of todosUsuarios) {
        for (let c of u.cartelas) {
            const ganhou = c.every(num => jogo.bolas.includes(num));
            if (ganhou) {
                jogo.ganhador = u.name;
                jogo.fase = "finalizado";
                await User.findByIdAndUpdate(u._id, { $inc: { saldo: jogo.premioAcumulado }, $set: { cartelas: [] } });
                // Limpa cartelas de todos para o próximo jogo
                await User.updateMany({}, { $set: { cartelas: [] } });
                return;
            }
        }
    }
}

function reiniciarGlobal() {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhador: null };
}

// --- ROTAS ---
app.get('/game-status', (req, res) => res.json(jogo));

app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(valor),
                description: `Crédito Bingo`,
                payment_method_id: 'pix',
                payer: { email: 'contato@bingoreal.com' },
                external_reference: userId
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).send(); }
});

app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        const p = await payment.get({ id: data.id });
        if (p.status === "approved") {
            await User.findByIdAndUpdate(p.external_reference, { $inc: { saldo: p.transaction_amount } });
        }
    }
    res.sendStatus(200);
});

app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    u ? res.json(u) : res.status(401).send();
});

app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.json(u); } catch(e) { res.status(400).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const user = await User.findById(usuarioId);
    const custo = quantidade * 2;
    if (user && user.saldo >= custo && jogo.fase === "acumulando") {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 15) { let num = Math.floor(Math.random()*50)+1; if(!n.includes(num)) n.push(num); }
            novas.push(n.sort((a,b)=>a-b));
        }
        await User.findByIdAndUpdate(usuarioId, { $inc: { saldo: -custo }, $push: { cartelas: { $each: novas } } });
        jogo.premioAcumulado += (custo * 0.7);
        res.json({ success: true });
    } else res.status(400).send();
});

app.listen(process.env.PORT || 10000);
