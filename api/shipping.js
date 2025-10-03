// Alias-Route für Kompatibilität: /api/shipping → nutzt denselben Handler wie /api/ship
import handler, { config } from './ship';
export default handler;
export { config };


