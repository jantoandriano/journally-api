import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, authHeader, createTestUser } from './helpers/testAuth';

const box = { south: -1, west: -1, north: 1, east: 1 };

/** Registers a sighting as whichever test user is currently "current". */
async function createSightingAsCurrentUser(): Promise<string> {
  const res = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body.id;
}

function reportAs(token: string, id: string, body: Record<string, unknown> = { reason: 'spam' }) {
  return request(app).post(`/sightings/${id}/report`).set(authHeader(token)).send(body);
}

function getAs(token: string, id: string) {
  return request(app).get(`/sightings/${id}`).set(authHeader(token));
}

function reportCount(sightingId: string) {
  return prisma.sightingReport.count({ where: { sightingId } });
}

describe('POST /sightings/:id/report', () => {
  it('creates a report and hides the sighting from the reporter only', async () => {
    const id = await createSightingAsCurrentUser(); // registrant = the default test user
    const reporter = await createTestUser();

    const res = await reportAs(reporter.accessToken, id, {
      reason: 'inappropriate',
      note: 'not ok',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ reported: true });

    expect((await getAs(reporter.accessToken, id)).status).toBe(404);
    const map = await request(app)
      .get('/sightings/map')
      .query(box)
      .set(authHeader(reporter.accessToken));
    expect(map.body).toEqual([]);
    const feed = await request(app)
      .post(`/sightings/${id}/feedings`)
      .set(authHeader(reporter.accessToken))
      .send({});
    expect(feed.status).toBe(404);

    const bystander = await createTestUser();
    expect((await getAs(bystander.accessToken, id)).status).toBe(200);
  });

  it('stores the reason and a trimmed note', async () => {
    const id = await createSightingAsCurrentUser();
    const reporter = await createTestUser();

    await reportAs(reporter.accessToken, id, { reason: 'private_info', note: '  house number  ' });

    const row = await prisma.sightingReport.findFirst({ where: { sightingId: id } });
    expect(row).toMatchObject({
      reporterId: reporter.user.id,
      reason: 'private_info',
      note: 'house number',
    });
  });

  it('is idempotent: a second report returns 200 and leaves one row', async () => {
    const id = await createSightingAsCurrentUser();
    const reporter = await createTestUser();

    const first = await reportAs(reporter.accessToken, id);
    const second = await reportAs(reporter.accessToken, id);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ reported: true });
    expect(await reportCount(id)).toBe(1);
  });

  it('rejects reporting your own sighting with 400', async () => {
    const owner = await createTestUser();
    const id = await createSightingAsCurrentUser();

    const res = await reportAs(owner.accessToken, id);

    expect(res.status).toBe(400);
    expect(await reportCount(id)).toBe(0);
  });

  it('returns 404 for a sighting that does not exist', async () => {
    const reporter = await createTestUser();

    const res = await reportAs(reporter.accessToken, 'does-not-exist');

    expect(res.status).toBe(404);
  });

  it.each([
    ['unknown reason', { reason: 'boring' }],
    ['missing reason', {}],
    ['note over 500 chars', { reason: 'other', note: 'x'.repeat(501) }],
  ])('rejects %s with 400', async (_label, body) => {
    const id = await createSightingAsCurrentUser();
    const reporter = await createTestUser();

    const res = await reportAs(reporter.accessToken, id, body);

    expect(res.status).toBe(400);
    expect(await reportCount(id)).toBe(0);
  });

  it('hides the sighting from everyone but its registrant at 3 distinct reporters', async () => {
    const owner = await createTestUser();
    const id = await createSightingAsCurrentUser();
    for (let i = 0; i < 2; i++) await reportAs((await createTestUser()).accessToken, id);
    const bystander = await createTestUser();
    expect((await getAs(bystander.accessToken, id)).status).toBe(200);

    await reportAs((await createTestUser()).accessToken, id); // third distinct reporter

    expect((await getAs(bystander.accessToken, id)).status).toBe(404);
    expect((await getAs(owner.accessToken, id)).status).toBe(200);
    expect((await prisma.sighting.findUnique({ where: { id } }))?.hiddenAt).not.toBeNull();
  });

  it('honours REPORT_HIDE_THRESHOLD', async () => {
    const previous = process.env.REPORT_HIDE_THRESHOLD;
    process.env.REPORT_HIDE_THRESHOLD = '1';
    try {
      const id = await createSightingAsCurrentUser();

      await reportAs((await createTestUser()).accessToken, id);

      expect((await prisma.sighting.findUnique({ where: { id } }))?.hiddenAt).not.toBeNull();
    } finally {
      if (previous === undefined) delete process.env.REPORT_HIDE_THRESHOLD;
      else process.env.REPORT_HIDE_THRESHOLD = previous;
    }
  });

  it('requires auth', async () => {
    const id = await createSightingAsCurrentUser();

    const res = await request(app).post(`/sightings/${id}/report`).send({ reason: 'spam' });

    expect(res.status).toBe(401);
  });
});
