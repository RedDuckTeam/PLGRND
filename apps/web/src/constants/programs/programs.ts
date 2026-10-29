import { COUNTER_PROGRAM_ID } from './counter/counter'
import counterIdl from './counter/counter.json'

export const PROGRAMS = [
  {
    programId: COUNTER_PROGRAM_ID,
    idl: counterIdl as { name?: string },
  },
]
