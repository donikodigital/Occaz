// backend/src/jobs/jobs.controller.spec.ts
// Déclencheur externe des traitements : fermé sans secret, 401 avec un mauvais, lance tout avec le bon.
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JobsController, jobsSecretMatches } from './jobs.controller';
import { JobsService } from './jobs.service';

const SECRET = 'un-secret-bien-long-pour-les-jobs-123456';

describe('JobsController.run', () => {
  const OLD = process.env.JOBS_SECRET;
  afterEach(() => {
    if (OLD === undefined) delete process.env.JOBS_SECRET;
    else process.env.JOBS_SECRET = OLD;
  });
  const build = () => {
    const jobs = { runAll: jest.fn().mockResolvedValue([{ job: 'a', ok: true, durationMs: 1 }]) };
    return { controller: new JobsController(jobs as never), jobs };
  };

  it('JOBS_SECRET absent : 404, rien ne tourne', async () => {
    delete process.env.JOBS_SECRET;
    const { controller, jobs } = build();
    await expect(controller.run(SECRET)).rejects.toBeInstanceOf(NotFoundException);
    expect(jobs.runAll).not.toHaveBeenCalled();
  });

  it('JOBS_SECRET trop court : 404', async () => {
    process.env.JOBS_SECRET = 'court';
    await expect(build().controller.run('court')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mauvais ou absent : 401', async () => {
    process.env.JOBS_SECRET = SECRET;
    const { controller, jobs } = build();
    await expect(controller.run('mauvais')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.run(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jobs.runAll).not.toHaveBeenCalled();
  });

  it('bon secret : lance les traitements et renvoie le résultat', async () => {
    process.env.JOBS_SECRET = SECRET;
    const { controller } = build();
    await expect(controller.run(SECRET)).resolves.toEqual({ ok: true, results: [{ job: 'a', ok: true, durationMs: 1 }] });
  });

  it('jobsSecretMatches compare sans erreur sur des longueurs différentes', () => {
    expect(jobsSecretMatches(SECRET, SECRET)).toBe(true);
    expect(jobsSecretMatches(SECRET, SECRET + 'x')).toBe(false);
    expect(jobsSecretMatches(SECRET, '')).toBe(false);
  });
});

describe('JobsService.runAll', () => {
  it('un traitement en échec n\'empêche pas les suivants', async () => {
    const ok = { runOnce: jest.fn().mockResolvedValue(undefined) };
    const boom = { runOnce: jest.fn().mockRejectedValue(new Error('boom')) };
    const service = new JobsService(ok as never, boom as never, ok as never, ok as never);
    const results = await service.runAll();
    expect(results.map((r) => [r.job, r.ok])).toEqual([['booking-expiry', true], ['trip-expiry', false], ['trip-reminders', true], ['shipment-window', true]]);
    expect(ok.runOnce).toHaveBeenCalledTimes(3);
  });
});
