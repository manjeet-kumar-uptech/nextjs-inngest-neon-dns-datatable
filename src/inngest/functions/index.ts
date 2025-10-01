// Export all Inngest functions
export { parseCsv } from './parseCsv'

// You can add more functions here as needed
// export { anotherFunction } from './anotherFunction'

// Export functions array for easier registration
import { parseCsv } from './parseCsv'
export const functions = [parseCsv]
