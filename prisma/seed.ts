import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const employees = [
  { name: "Cyril", initials: "C", role: "Advisor", department: "Advisory", location: null, avatarColor: "c-adv", order: 0, timezone: "CET", workHours: "Flexible" },
  { name: "Arthur", initials: "A", role: "Shareholder", department: "Shareholders", location: null, avatarColor: "c-sh", order: 0, entity: "Green Nation SARL" },
  { name: "Vernon", initials: "V", role: "CEO / Shareholder", department: "Shareholders", location: "Dubai", avatarColor: "c-sh", order: 1, email: "vernon@oxen.finance", phone: "+971 50 000 0000", telegram: "@vernon_oxen", timezone: "GST", workHours: "Mon-Fri 09:00-18:00", entity: "Oxen Finance", isAdmin: true },
  { name: "Paul Louis", initials: "PL", role: "Shareholder", department: "Shareholders", location: "Dubai", avatarColor: "c-sh", order: 2, entity: "Green Nation SARL" },
  { name: "Aleks", initials: "A", role: "Operations", department: "Operations", location: "Dubai", avatarColor: "c-ops", order: 0, timezone: "GST", workHours: "Mon-Fri 09:00-18:00", entity: "Oxen Finance" },
  { name: "Luiza", initials: "L", role: "Account Client Manager", department: "Account Management", location: "Dubai", avatarColor: "c-sales", order: 0, timezone: "GST", entity: "Oxen Finance" },
  { name: "Rudolfs", initials: "R", role: "Finance", department: "Finance", location: "Potentiellement Dubai", avatarColor: "c-fin", order: 0, entity: "Escrowfy GmbH" },
  { name: "Ervins", initials: "E", role: "Sales", department: "Sales", location: null, avatarColor: "c-sales", order: 0, entity: "Oxen Finance" },
  { name: "Andy", initials: "A", role: "Sales", department: "Sales", location: "Dubai", avatarColor: "c-sales", order: 1, timezone: "GST", entity: "Oxen Finance" },
  { name: "Veronika", initials: "V", role: "Compliance", department: "Compliance", location: null, avatarColor: "c-comp", order: 0, entity: "Escrowfy GmbH" },
  { name: "Aysegul", initials: "A", role: "Compliance", department: "Compliance", location: "UK", avatarColor: "c-comp", order: 1, timezone: "GMT", entity: "Escrowfy GmbH" },
  { name: "Christel", initials: "C", role: "Customer Support", department: "Support", location: null, avatarColor: "c-sup", order: 0, entity: "Oxen Finance" },
  { name: "Tsiaro", initials: "T", role: "Customer Support", department: "Support", location: null, avatarColor: "c-sup", order: 1, entity: "Oxen Finance" },
  { name: "Mickael", initials: "M", role: "Tech Lead", department: "Tech", location: "Dubai", avatarColor: "c-tech", order: 0, telegram: "@mickael_dev", timezone: "GST", workHours: "Mon-Fri 10:00-19:00", entity: "Lapki Digital Pay Inc." },
  { name: "Cardaq", initials: "CD", role: "Backend Engineer", department: "Tech", location: "Remote", avatarColor: "c-tech", order: 1, timezone: "CET", entity: "Oxen Finance" },
]

const tasks = [
  { title: "MiCA pre-assessment report", tag: "compliance", priority: "high", assignee: "Vernon", deadline: new Date("2025-03-15"), column: "todo", order: 0, createdBy: "system" },
  { title: "Falcon Group SA — EDD review", tag: "onboarding", priority: "high", assignee: "Arthur", deadline: new Date("2025-03-12"), column: "todo", order: 1, createdBy: "system" },
  { title: "Stampede bot — payment flow testing", tag: "tech", priority: "medium", assignee: "Mickael", deadline: new Date("2025-03-18"), column: "todo", order: 2, createdBy: "system" },
  { title: "LP negotiation — spread optimization", tag: "sales", priority: "high", assignee: "Ervins", deadline: new Date("2025-03-13"), column: "todo", order: 3, createdBy: "system" },
  { title: "SiGMA follow-up — 12 leads", tag: "sales", priority: "medium", assignee: "Andy", deadline: new Date("2025-03-14"), column: "inprogress", order: 0, createdBy: "system" },
  { title: "Fireblocks custody integration", tag: "tech", priority: "high", assignee: "Cardaq", deadline: new Date("2025-03-20"), column: "inprogress", order: 1, createdBy: "system" },
  { title: "FINTRAC quarterly filing", tag: "compliance", priority: "medium", assignee: "Vernon", deadline: new Date("2025-03-31"), column: "inprogress", order: 2, createdBy: "system" },
  { title: "Meridian Ventures — KYB complete", tag: "onboarding", priority: "low", assignee: "Arthur", deadline: new Date("2025-03-10"), column: "done", order: 0, createdBy: "system" },
  { title: "Rain card issuing model review", tag: "compliance", priority: "medium", assignee: "Vernon", deadline: new Date("2025-03-08"), column: "done", order: 1, createdBy: "system" },
  { title: "Oxen Telegram sales bot live", tag: "tech", priority: "low", assignee: "Mickael", deadline: new Date("2025-03-05"), column: "done", order: 2, createdBy: "system" },
]

const orgEntities = [
  { id: "gn", name: "Green Nation SARL", jurisdiction: "Luxembourg", type: "Holding Company", parentId: null, order: 0 },
  { id: "escrowfy", name: "Escrowfy GmbH", jurisdiction: "Switzerland", type: "SRO Regulated · VASP", parentId: "gn", order: 0 },
  { id: "lapki", name: "Lapki Digital Pay Inc.", jurisdiction: "Canada", type: "MSB · FINTRAC", parentId: "gn", order: 1 },
  { id: "galaktika", name: "Galaktika Pay", jurisdiction: "TBD", type: "Payment Gateway", parentId: "gn", order: 2 },
  { id: "oxen-dubai", name: "Oxen Dubai", jurisdiction: "UAE", type: "Operating Entity", parentId: "gn", order: 3 },
  { id: "oxen-lic", name: "Oxen Licensing Lux", jurisdiction: "Luxembourg", type: "IP / Licensing", parentId: "gn", order: 4 },
  { id: "oxen", name: "Oxen Finance", jurisdiction: "Multi-jurisdiction", type: "Platform · Brand", parentId: "escrowfy", order: 0 },
  { id: "stampede", name: "Stampede by Lapki Pay", jurisdiction: "Canada", type: "Telegram Crypto Bot", parentId: "lapki", order: 0 },
]

async function main() {
  console.log("Seeding employees...")
  for (const emp of employees) {
    await prisma.employee.create({ data: emp })
  }
  console.log(`Seeded ${employees.length} employees.`)

  console.log("Seeding tasks...")
  for (const task of tasks) {
    await prisma.task.create({ data: task })
  }
  console.log(`Seeded ${tasks.length} tasks.`)

  console.log("Seeding org entities...")
  // Create in order: roots first, then children
  const roots = orgEntities.filter(e => !e.parentId)
  const children = orgEntities.filter(e => e.parentId)
  for (const entity of roots) {
    await prisma.orgEntity.create({ data: entity })
  }
  for (const entity of children) {
    await prisma.orgEntity.create({ data: entity })
  }
  console.log(`Seeded ${orgEntities.length} org entities.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
