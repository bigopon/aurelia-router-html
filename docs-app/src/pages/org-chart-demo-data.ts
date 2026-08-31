export interface Person {
  id: string;
  name: string;
  title: string;
  blurb: string;
  reports: readonly string[];
}

export const rootId = 'ceo';

export const people: Record<string, Person> = {
  ceo: {
    id: 'ceo',
    name: 'Mina Shah',
    title: 'Chief Executive Officer',
    blurb: 'Owns the company strategy and the top-level route into the org graph.',
    reports: ['head-people', 'head-product', 'cfo'],
  },
  'head-people': {
    id: 'head-people',
    name: 'Noah Kim',
    title: 'Head of People',
    blurb: 'Leads hiring, onboarding, and manager enablement.',
    reports: ['recruiting-lead', 'enablement-lead'],
  },
  'head-product': {
    id: 'head-product',
    name: 'Sara Patel',
    title: 'Head of Product',
    blurb: 'Owns product strategy and the design plus platform branches.',
    reports: ['platform-director', 'design-manager'],
  },
  cfo: {
    id: 'cfo',
    name: 'Jonas Berg',
    title: 'Chief Financial Officer',
    blurb: 'Manages planning, capital, and finance operations.',
    reports: ['controller'],
  },
  'recruiting-lead': {
    id: 'recruiting-lead',
    name: 'Priya Nair',
    title: 'Recruiting Lead',
    blurb: 'Runs hiring pipelines across engineering and go-to-market.',
    reports: [],
  },
  'enablement-lead': {
    id: 'enablement-lead',
    name: 'Leo Martin',
    title: 'Manager Enablement Lead',
    blurb: 'Builds training and internal playbooks for new managers.',
    reports: [],
  },
  'platform-director': {
    id: 'platform-director',
    name: 'Ava Chen',
    title: 'Platform Director',
    blurb: 'Owns developer platform, CI, and shared services.',
    reports: ['data-platform-lead'],
  },
  'design-manager': {
    id: 'design-manager',
    name: 'Marta Silva',
    title: 'Design Manager',
    blurb: 'Coordinates product design, systems, and UX research.',
    reports: ['frontend-lead', 'brand-lead'],
  },
  controller: {
    id: 'controller',
    name: 'Owen Scott',
    title: 'Controller',
    blurb: 'Closes the books and maintains financial reporting controls.',
    reports: [],
  },
  'data-platform-lead': {
    id: 'data-platform-lead',
    name: 'Eli Walker',
    title: 'Data Platform Lead',
    blurb: 'Maintains event pipelines, warehousing, and analytics tooling.',
    reports: [],
  },
  'frontend-lead': {
    id: 'frontend-lead',
    name: 'Tara Brooks',
    title: 'Frontend Lead',
    blurb: 'Leads the design-system and application-shell teams.',
    reports: ['staff-ui-engineer'],
  },
  'brand-lead': {
    id: 'brand-lead',
    name: 'Diego Ruiz',
    title: 'Brand Design Lead',
    blurb: 'Owns visual identity and campaign design systems.',
    reports: [],
  },
  'staff-ui-engineer': {
    id: 'staff-ui-engineer',
    name: 'Nina Lopez',
    title: 'Staff UI Engineer',
    blurb: 'Leaf node. This branch stops here because there are no more direct reports.',
    reports: [],
  },
};

const firstNames = ['Mina', 'Noah', 'Sara', 'Jonas', 'Priya', 'Leo', 'Ava', 'Marta', 'Owen', 'Eli', 'Tara', 'Diego', 'Nina', 'Ivy', 'Caleb', 'Rhea', 'Amir', 'Lena', 'Milo', 'Sonia'];
const lastNames = ['Shah', 'Kim', 'Patel', 'Berg', 'Nair', 'Martin', 'Chen', 'Silva', 'Scott', 'Walker', 'Brooks', 'Ruiz', 'Lopez', 'Stone', 'Young', 'Park', 'Diaz', 'Cole', 'Singh', 'Nguyen'];
const teamNames = ['Platform', 'Design', 'Growth', 'Revenue', 'Data', 'Security', 'Support', 'Operations', 'Talent', 'Research'];

populateOrg(people, 200);

export function getPerson(id: string): Person | null {
  return people[id] ?? null;
}

function populateOrg(store: Record<string, Person>, targetSize: number): void {
  const depths = calculateDepths(store);
  const queue = Object.keys(store).sort((left, right) => (depths.get(left) ?? 0) - (depths.get(right) ?? 0));
  let counter = 1;
  while (Object.keys(store).length < targetSize && queue.length > 0) {
    const parentId = queue.shift()!;
    const parent = store[parentId];
    const depth = depths.get(parentId) ?? 0;
    const maxReports = depth < 1 ? 4 : depth < 3 ? 3 : depth < 5 ? 2 : 1;
    while (parent.reports.length < maxReports && Object.keys(store).length < targetSize) {
      const childId = `person-${String(counter++).padStart(3, '0')}`;
      const childDepth = depth + 1;
      store[childId] = {
        id: childId,
        name: `${firstNames[counter % firstNames.length]} ${lastNames[(counter + childDepth) % lastNames.length]}`,
        title: titleForDepth(childDepth, counter),
        blurb: `Owns the ${teamNames[(counter + childDepth) % teamNames.length].toLowerCase()} scope inside the ${parent.title.toLowerCase()} branch.`,
        reports: [],
      };
      parent.reports = [...parent.reports, childId];
      depths.set(childId, childDepth);
      queue.push(childId);
    }
  }
}

function calculateDepths(store: Record<string, Person>): Map<string, number> {
  const depths = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const person = store[id];
    const depth = depths.get(id) ?? 0;
    for (const reportId of person?.reports ?? []) {
      if (!depths.has(reportId)) {
        depths.set(reportId, depth + 1);
        queue.push(reportId);
      }
    }
  }
  return depths;
}

function titleForDepth(depth: number, index: number): string {
  if (depth <= 1) return ['Chief of Staff', 'Chief Architect', 'Chief Growth Officer', 'Chief Delivery Officer'][index % 4];
  if (depth === 2) return `Vice President of ${teamNames[index % teamNames.length]}`;
  if (depth === 3) return `Director of ${teamNames[index % teamNames.length]}`;
  if (depth === 4) return `${teamNames[index % teamNames.length]} Manager`;
  if (depth === 5) return `Lead ${teamNames[index % teamNames.length]} Partner`;
  return `Senior ${teamNames[index % teamNames.length]} Specialist`;
}
