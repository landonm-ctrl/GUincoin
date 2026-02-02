import { Router } from 'express';

const router = Router();

router.get('/spaces', (_req, res) => {
  res.json({ spaces: [] });
});

export default router;
