import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const employees = [
  {
    name: "Cyril",
    initials: "C",
    role: "Advisor",
    department: "Advisory",
    location: null,
    avatarColor: "c-adv",
    order: 0,
  },
  {
    name: "Arthur",
    initials: "A",
    role: "Shareholder",
    department: "Shareholders",
    location: null,
    avatarColor: "c-sh",
    order: 0,
  },
  {
    name: "Vernon",
    initials: "V",
    role: "CEO / Shareholder",
    department: "Shareholders",
    location: "Dubai",
    avatarColor: "c-sh",
    order: 1,
  },
  {
    name: "Paul Louis",
    initials: "PL",
    role: "Shareholder",
    department: "Shareholders",
    location: "Dubai",
    avatarColor: "c-sh",
    order: 2,
  },
  {
    name: "Aleks",
    initials: "A",
    role: "Operations",
    department: "Operations",
    location: "Dubai",
    avatarColor: "c-ops",
    order: 0,
  },
  {
    name: "Luiza",
    initials: "L",
    role: "Account Client Manager",
    department: "Account Management",
    location: "Dubai",
    avatarColor: "c-sales",
    order: 0,
  },
  {
    name: "Rudolfs",
    initials: "R",
    role: "Finance",
    department: "Finance",
    location: "Potentiellement Dubai",
    avatarColor: "c-fin",
    order: 0,
  },
  {
    name: "Ervins",
    initials: "E",
    role: "Sales",
    department: "Sales",
    location: null,
    avatarColor: "c-sales",
    order: 0,
  },
  {
    name: "Andy",
    initials: "A",
    role: "Sales",
    department: "Sales",
    location: "Dubai",
    avatarColor: "c-sales",
    order: 1,
  },
  {
    name: "Veronika",
    initials: "V",
    role: "Compliance",
    department: "Compliance",
    location: null,
    avatarColor: "c-comp",
    order: 0,
  },
  {
    name: "Aysegul",
    initials: "A",
    role: "Compliance",
    department: "Compliance",
    location: "UK",
    avatarColor: "c-comp",
    order: 1,
  },
  {
    name: "Christel",
    initials: "C",
    role: "Customer Support",
    department: "Support",
    location: null,
    avatarColor: "c-sup",
    order: 0,
  },
  {
    name: "Tsiaro",
    initials: "T",
    role: "Customer Support",
    department: "Support",
    location: null,
    avatarColor: "c-sup",
    order: 1,
  },
  {
    name: "Ingénieur IA #1",
    initials: "IA",
    role: "À recruter",
    department: "Tech",
    location: "Dubai",
    avatarColor: "c-tech",
    order: 0,
  },
  {
    name: "Ingénieur IA #2",
    initials: "IA",
    role: "À recruter",
    department: "Tech",
    location: "Dubai",
    avatarColor: "c-tech",
    order: 1,
  },
  {
    name: "Ingénieur IA #3",
    initials: "IA",
    role: "À recruter",
    department: "Tech",
    location: "Dubai",
    avatarColor: "c-tech",
    order: 2,
  },
]

async function main() {
  console.log("Seeding employees...")

  for (const emp of employees) {
    await prisma.employee.create({ data: emp })
  }

  console.log(`Seeded ${employees.length} employees.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
