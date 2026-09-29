/**
 * Permite ejecutar las pruebas en otra zona horaria: TEST_TZ=Asia/Tokyo npx jest --runInBand
 * En Windows, Node ignora la variable TZ al arrancar; fijarla en tiempo de ejecución sí funciona,
 * pero solo en este proceso (por eso --runInBand).
 */
module.exports = () => {
  if (process.env.TEST_TZ) process.env.TZ = process.env.TEST_TZ;
};
