const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. ISSO RESOLVE O ERRO "CANNOT GET /"
// Diz ao servidor para usar a pasta atual para encontrar o index.html
app.use(express.static(__dirname));

// 2. CONECTA AO BANCO DE DADOS USANDO A VARIÁVEL DO RENDER
const mongoURI = process.env.MONGO_URI; 
mongoose.connect(mongoURI).then(() => console.log("Bingo Conectado!"));

// 3. CONFIGURA O MERCADO PAGO
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// Rota principal para abrir o jogo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ... resto do seu código de sorteio e apostas ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
