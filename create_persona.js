const { PrismaClient } = require('./src/generated/prisma');
const p = new PrismaClient();

p.user.create({
  data: {
    name: 'Tatanga Persona',
    email: 'import@cssberlin.de',
    isPersonaAccount: true
  }
}).then(u => {
  console.log('Created persona:', u.id);
}).catch(e => {
  console.error(e);
}).finally(() => {
  p.$disconnect();
});
