/**
 * Script to update all KPIs with null minAcceptedEvidence to 1
 * Run this script once to fix existing data
 */

import dotenv from 'dotenv'
import path from 'path'
import { existsSync } from 'fs'

// Load environment variables
const backendEnvPath = path.resolve(__dirname, '../../.env')
const rootEnvPath = path.resolve(__dirname, '../../../.env')

if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
} else if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
} else {
  dotenv.config()
}

import { prisma } from '../lib/db'

async function updateMinAcceptedEvidence() {
  try {
    console.log('🔄 Updating KPIs with null minAcceptedEvidence to 1...')
    
    const result = await prisma.kPI.updateMany({
      where: {
        minAcceptedEvidence: null,
      },
      data: {
        minAcceptedEvidence: 1,
      },
    })

    console.log(`✅ Updated ${result.count} KPIs`)
    console.log('✨ Done!')
  } catch (error: any) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
updateMinAcceptedEvidence()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

