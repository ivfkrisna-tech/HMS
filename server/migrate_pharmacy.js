const mongoose = require('mongoose');
const PharmacyOrder = require('./src/models/pharmacyOrder.model');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const pharm = await PharmacyOrder.find({});
  let updatedCount = 0;

  for (let p of pharm) {
      let calcTotal = 0;
      if (p.items && p.items.length > 0) {
          p.items.forEach(item => {
              if (item.price) calcTotal += item.price;
          });
      }

      // If they had items but no price, let's just mock a price of 250 for testing
      if (calcTotal === 0 && p.items && p.items.length > 0) {
          calcTotal = p.items.length * 250;
      }
      
      // If still 0 (no items), just set 300
      if (calcTotal === 0) {
          calcTotal = 300;
      }

      p.totalAmount = calcTotal;
      p.totalCost = calcTotal * 0.4; // 40% cost margin for profit calculation
      p.paymentStatus = 'Paid';
      p.orderStatus = 'Completed';
      
      await p.save();
      updatedCount++;
  }
  
  console.log(`Successfully migrated ${updatedCount} pharmacy orders to Paid with mocked amounts.`);
  process.exit(0);
}
run();
