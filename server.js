const express = require('express');
const stripe = require('stripe')('sk_test_51S colocar aqui tu llave'); // 
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Datos de ejemplo (en producción usarías una base de datos)
let students = {
  1: { 
    id: 1, 
    name: 'Ana García', 
    email: 'ana@escuela.com',
    balance: 1500.00,
    career: 'Ingeniería de Software'
  },
  2: { 
    id: 2, 
    name: 'Carlos López', 
    email: 'carlos@escuela.com',
    balance: 2000.00, 
    career: 'Administración'
  }
};

let transactions = [];

// Endpoint de salud
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Servidor de Pagos Escolares con Stripe',
    status: 'Online',
    gateway: 'Stripe Test Mode'
  });
});

// Obtener información del estudiante
app.get('/api/student/:id', (req, res) => {
  const student = students[req.params.id];
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }
  res.json(student);
});

// 🔥 ENDPOINT PRINCIPAL: Procesar pago con Stripe
app.post('/api/process-payment', async (req, res) => {
  const { studentId, amount, paymentMethod, description = 'Pago escolar' } = req.body;

  console.log('📦 Recibiendo solicitud de pago:', { studentId, amount, paymentMethod });

  try {
    // 1. Validar estudiante
    const student = students[studentId];
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: 'Estudiante no encontrado' 
      });
    }

    // 2. Validar monto
    if (amount <= 0 || amount > 10000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Monto inválido. Debe ser entre $1 y $10,000' 
      });
    }

    if (amount > student.balance) {
      return res.status(400).json({ 
        success: false, 
        error: 'Saldo insuficiente' 
      });
    }

    // 3. 🚀 PROCESAR PAGO CON STRIPE
    console.log('💳 Procesando pago con Stripe...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir a centavos
      currency: 'mxn', // o 'usd' según tu moneda
      payment_method: paymentMethod,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        student_id: studentId,
        student_name: student.name,
        description: description
      },
      description: `Pago escolar - ${student.name}`
    });

    console.log('✅ Respuesta de Stripe:', paymentIntent.status);

    // 4. Verificar resultado del pago
    if (paymentIntent.status === 'succeeded') {
      // 5. Actualizar saldo del estudiante
      const previousBalance = student.balance;
      student.balance -= amount;

      // 6. Registrar transacción
      const transaction = {
        id: paymentIntent.id,
        studentId: studentId,
        studentName: student.name,
        amount: amount,
        description: description,
        previousBalance: previousBalance,
        newBalance: student.balance,
        status: 'completed',
        paymentGateway: 'stripe',
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method_types[0],
        date: new Date().toISOString(),
        stripeData: {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status
        }
      };

      transactions.push(transaction);

      // 7. Enviar respuesta exitosa
      res.json({
        success: true,
        message: '✅ Pago procesado exitosamente',
        paymentId: paymentIntent.id,
        status: paymentIntent.status,
        student: {
          id: student.id,
          name: student.name,
          newBalance: student.balance
        },
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          date: transaction.date
        }
      });

    } else {
      // Pago fallido
      res.status(400).json({
        success: false,
        error: `❌ Pago fallido: ${paymentIntent.status}`,
        status: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('🔥 Error procesando pago:', error);
    
    // Manejar errores específicos de Stripe
    if (error.type === 'StripeCardError') {
      res.status(400).json({
        success: false,
        error: `❌ Error de tarjeta: ${error.message}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: `🔥 Error del servidor: ${error.message}`
      });
    }
  }
});

// Obtener historial de transacciones
app.get('/api/transactions/:studentId', (req, res) => {
  const studentTransactions = transactions
    .filter(t => t.studentId == req.params.studentId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.json(studentTransactions);
});

// Obtener todas las transacciones (admin)
app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Servidor ejecutándose en puerto', PORT);
  console.log('💳 Configurado con Stripe Test Mode');
  console.log('📧 Endpoints disponibles:');
  console.log('   GET  /api/student/:id');
  console.log('   POST /api/process-payment');
  console.log('   GET  /api/transactions/:studentId');
});
