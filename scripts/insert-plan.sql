-- Insere o "Plano semanal completo" na conta Goalbud de danielimalmeida@gmail.com.
--
-- Como correr: Supabase dashboard → SQL editor → colar tudo e executar
-- (ou: psql "$DATABASE_URL" -f scripts/insert-plan.sql).
--
-- SQL simples, sem blocos DO nem funções, para o editor do dashboard não se
-- atrapalhar. O e-mail aparece 3 vezes (uma por insert): muda-o em todas se
-- necessário. O script é idempotente: os ids são derivados de nomes fixos, por
-- isso voltar a correr actualiza em vez de duplicar. Sessões e entradas já
-- registadas nunca são tocadas.
--
-- O que cria:
--   Goals    Base: mobilidade (8 min)          diário, não-negociável
--            Reforço: ancas + ombro (10 min)   3x por semana (contagem semanal; colar aos dias de ginásio)
--            Ginásio                           seg/qua/sex, exercise goal: abre o workout picker e fica feito ao terminar a sessão
--            Ténis                             ter/sáb
--            Ganhar 2-3 kg de músculo          long goal a 1 ano, com filhos:
--              Proteína 140-145 g              diário
--              Pesar-me em jejum               segunda
--            Fisioterapia do ombro: marcar     long goal a 4 semanas
--   Workouts Base (mobilidade) · Reforço (ancas + ombro) · Ginásio A · Ginásio B · Ginásio C
--   Reps: o alvo por série é o topo do intervalo (4 x 5-8 → 8), que é o critério de progressão.
--   Pesos ficam vazios; preenche na primeira sessão. "(por lado)" no nome = repetir a série de cada lado.
--   Os workouts ficam sem descanso próprio (null) para valer o descanso de cada exercício.
--
-- Se o e-mail não existir em auth.users, o primeiro insert falha com
-- "null value in column user_id", que é o sinal para corrigir o e-mail.

------------------------------------------------------------------ 1. goals
-- schedule: uma versão a partir da segunda-feira desta semana (a semana começa à segunda).
insert into public.goals (id, user_id, name, shape, colour, icon, is_exercise, state, parent_id, schedule, target_date, created_on, sort_order)
select
  md5('goalbud:goal:' || g.key)::uuid,
  (select id from auth.users where lower(email) = lower('danielimalmeida@gmail.com')),
  g.name, g.shape, g.colour, g.icon, g.is_exercise, 'active',
  case when g.parent is null then null else md5('goalbud:goal:' || g.parent)::uuid end,
  case when g.version is null then '[]'::jsonb
       else jsonb_build_array(g.version || jsonb_build_object('from', date_trunc('week', current_date)::date)) end,
  case when g.target_weeks is null then null else (current_date + g.target_weeks * interval '1 week')::date end,
  current_date,
  g.sort_order
from (values
  -- key         nome                                shape        cor       ícone       exercise? pai      versão do horário (null = long goal)                       prazo (semanas) ordem
  ('base',     'Base: mobilidade (8 min)',          'scheduled', 'sage',   'ring',     false,    null,    '{"recurrence": {"kind": "daily"}}'::jsonb,                null::int,      0),
  ('reforco',  'Reforço: ancas + ombro (10 min)',   'weekly',    'teal',   'wave',     false,    null,    '{"timesPerWeek": 3}',                                     null,           1),
  ('ginasio',  'Ginásio',                           'scheduled', 'rust',   'diamond',  true,     null,    '{"recurrence": {"kind": "weekdays", "days": [1, 3, 5]}}', null,           2),
  ('tenis',    'Ténis',                             'scheduled', 'gold',   'star',     false,    null,    '{"recurrence": {"kind": "weekdays", "days": [2, 6]}}',    null,           3),
  ('massa',    'Ganhar 2-3 kg de músculo',          'long',      'purple', 'triangle', false,    null,    null,                                                      52,             4),
  ('proteina', 'Proteína 140-145 g',                'scheduled', 'purple', 'dot',      false,    'massa', '{"recurrence": {"kind": "daily"}}',                       null,           5),
  ('pesar',    'Pesar-me em jejum',                 'scheduled', 'purple', 'columns',  false,    'massa', '{"recurrence": {"kind": "weekdays", "days": [1]}}',       null,           6),
  ('fisio',    'Fisioterapia do ombro: marcar',     'long',      'rose',   'plus',     false,    null,    null,                                                      4,              7)
) as g(key, name, shape, colour, icon, is_exercise, parent, version, target_weeks, sort_order)
on conflict (id) do update set
  name = excluded.name, shape = excluded.shape, colour = excluded.colour, icon = excluded.icon,
  is_exercise = excluded.is_exercise, parent_id = excluded.parent_id, schedule = excluded.schedule,
  target_date = excluded.target_date, sort_order = excluded.sort_order;

-------------------------------------------------------------- 2. exercises
-- (chave, nome, tipo, descanso em segundos; 0 = sem temporizador)
insert into public.exercises (id, user_id, name, kind, rest_seconds)
select
  md5('goalbud:exercise:' || e.key)::uuid,
  (select id from auth.users where lower(email) = lower('danielimalmeida@gmail.com')),
  e.name, e.kind, e.rest
from (values
  -- Base: ancas
  ('bola',      'Bola de ténis ou rolo no glúteo (por lado)',                  'time', 0),
  ('9090',      '90/90: rodar de um lado ao outro (trocas)',                   'reps', 0),
  ('9090ext',   '90/90: segurar no extremo, tronco à frente (por lado)',       'time', 0),
  ('fig4',      'Figura 4 sentado na cadeira (por lado)',                      'time', 0),
  ('agsusp',    'Agachamento profundo em suspensão, cotovelos a abrir joelhos', 'time', 0),
  -- Base: ombro
  ('wall',      'Wall slides',                                                 'reps', 0),
  ('dorsal',    'Extensão e rotação dorsal, deitado de lado (por lado)',       'reps', 0),
  ('cruzado',   'Alongamento cruzado à frente do peito (por lado)',            'time', 0),
  ('toalha',    'Toalha pelas costas, nunca à força',                          'time', 0),
  -- Reforço: ancas
  ('lev9090',   'Levantar do chão a partir do 90/90, sem mãos (por lado)',     'reps', 30),
  ('ponte',     'Ponte de glúteo a uma perna, apertar no topo (por lado)',     'reps', 30),
  ('abd',       'Abdução deitado de lado, pé rodado para dentro (por lado)',   'reps', 30),
  ('balanco',   'Balanços de abdutores em quatro apoios (por lado)',           'reps', 30),
  ('airplane',  'Hip airplane, roda a bacia e não os ombros (por lado)',       'reps', 30),
  -- Reforço: ombro direito (sem dor; leve)
  ('rotext',    'Rotação externa com banda, cotovelo junto ao corpo',          'reps', 30),
  ('rotint',    'Rotação interna com banda, cotovelo junto ao corpo',          'reps', 30),
  ('belly',     'Belly press, segurar 5s',                                     'reps', 30),
  ('facebanda', 'Face pull com banda',                                         'reps', 30),
  -- Ginásio: comum
  ('bike',      'Bicicleta ou remo (aquecimento)',                             'time', 0),
  ('baseref',   'Base + Reforço (ancas e ombro)',                              'time', 0),
  ('marcha',    'Marcha lateral com banda acima dos joelhos (por lado)',       'reps', 30),
  ('alongar',   'Alongamento: anca, peitoral, gémeos',                         'time', 0),
  -- Ginásio A
  ('agach',     'Agachamento (barra ou goblet), pés um pouco mais afastados',  'reps', 150),
  ('supinc',    'Supino inclinado com halteres, não descer abaixo do ombro',   'reps', 120),
  ('rdl',       'Peso morto romeno',                                           'reps', 150),
  ('remuni',    'Remada unilateral com haltere',                               'reps', 90),
  ('prlat',     'Prancha lateral (por lado)',                                  'time', 60),
  -- Ginásio B
  ('elev',      'Elevações ou puxada alta, pega neutra',                       'reps', 150),
  ('bulg',      'Agachamento búlgaro, tronco ligeiramente à frente (por perna)', 'reps', 90),
  ('landmine',  'Landmine press ou press inclinado a 45°',                     'reps', 120),
  ('facepull',  'Face pull + rotação externa com banda',                       'reps', 60),
  ('farmer',    'Farmer''s walk (metros)',                                     'reps', 90),
  ('copen',     'Copenhagen plank, joelho apoiado (por lado)',                 'time', 60),
  -- Ginásio C
  ('salto',     'Salto na caixa ou vertical, explosivo',                       'reps', 180),
  ('hipthrust', 'Hip thrust ou peso morto',                                    'reps', 150),
  ('supplano',  'Supino plano com halteres',                                   'reps', 120),
  ('rempolia',  'Remada na polia baixa',                                       'reps', 90),
  ('biceps',    'Bíceps',                                                      'reps', 60),
  ('triceps',   'Tríceps na polia, não atrás da cabeça',                       'reps', 60),
  ('pallof',    'Pallof press (por lado)',                                     'reps', 60)
) as e(key, name, kind, rest)
on conflict (id) do update set
  name = excluded.name, kind = excluded.kind, rest_seconds = excluded.rest_seconds, archived = false;

--------------------------------------------------------------- 3. workouts
-- (workout, ordem, exercício, séries, reps | null, segundos | null)
insert into public.workouts (id, user_id, name, rest_seconds, exercises)
select
  md5('goalbud:workout:' || w.key)::uuid,
  (select id from auth.users where lower(email) = lower('danielimalmeida@gmail.com')),
  w.name, null,
  (select jsonb_agg(
      jsonb_build_object(
        'exerciseId', md5('goalbud:exercise:' || p.key)::uuid,
        'sets', (select jsonb_agg(s.obj) from (
                   select jsonb_build_object('reps', p.reps, 'weight', null, 'seconds', p.seconds) as obj
                   from generate_series(1, p.n)) s))
      order by p.pos)
   from (values
     -- Base: mobilidade, 8 min, todos os dias (antes do ténis; nos dias de ginásio é o aquecimento)
     ('base', 1, 'bola',      1, null, 90),
     ('base', 2, '9090',      1, 10,   null),
     ('base', 3, '9090ext',   1, null, 30),
     ('base', 4, 'fig4',      1, null, 40),
     ('base', 5, 'agsusp',    1, null, 60),
     ('base', 6, 'wall',      2, 10,   null),
     ('base', 7, 'dorsal',    1, 8,    null),
     ('base', 8, 'cruzado',   1, null, 30),
     ('base', 9, 'toalha',    3, null, 20),
     -- Reforço: ancas + ombro, 10 min, 3-4x por semana, logo a seguir à Base
     ('ref', 1, 'lev9090',    1, 5,    null),
     ('ref', 2, 'ponte',      1, 10,   null),
     ('ref', 3, 'abd',        1, 15,   null),
     ('ref', 4, 'balanco',    1, 10,   null),
     ('ref', 5, 'airplane',   1, 8,    null),
     ('ref', 6, 'rotext',     2, 15,   null),
     ('ref', 7, 'rotint',     2, 15,   null),
     ('ref', 8, 'belly',      2, 10,   null),
     ('ref', 9, 'facebanda',  2, 15,   null),
     -- Ginásio A: pernas + empurrar
     ('a', 1, 'bike',      1, null, 300),
     ('a', 2, 'baseref',   1, null, 1080),
     ('a', 3, 'marcha',    2, 15,   null),
     ('a', 4, 'agach',     4, 8,    null),   -- 4 x 5-8
     ('a', 5, 'supinc',    3, 10,   null),   -- 3 x 6-10
     ('a', 6, 'rdl',       3, 8,    null),
     ('a', 7, 'remuni',    3, 10,   null),
     ('a', 8, 'prlat',     3, null, 30),
     ('a', 9, 'alongar',   1, null, 300),
     -- Ginásio B: puxar + unilateral
     ('b', 1, 'bike',      1, null, 300),
     ('b', 2, 'baseref',   1, null, 1080),
     ('b', 3, 'marcha',    2, 15,   null),
     ('b', 4, 'elev',      4, 10,   null),   -- 4 x 6-10
     ('b', 5, 'bulg',      3, 8,    null),
     ('b', 6, 'landmine',  3, 10,   null),   -- 3 x 6-10
     ('b', 7, 'facepull',  3, 15,   null),
     ('b', 8, 'farmer',    3, 40,   null),   -- 3 x 40 m
     ('b', 9, 'copen',     2, null, 20),
     ('b', 10, 'alongar',  1, null, 300),
     -- Ginásio C: potência + corpo inteiro
     ('c', 1, 'bike',      1, null, 300),
     ('c', 2, 'baseref',   1, null, 1080),
     ('c', 3, 'marcha',    2, 15,   null),
     ('c', 4, 'salto',     4, 3,    null),   -- explosivo, descanso total
     ('c', 5, 'hipthrust', 3, 5,    null),
     ('c', 6, 'supplano',  3, 8,    null),
     ('c', 7, 'rempolia',  3, 10,   null),
     ('c', 8, 'biceps',    2, 12,   null),
     ('c', 9, 'triceps',   2, 12,   null),
     ('c', 10, 'pallof',   3, 10,   null),
     ('c', 11, 'alongar',  1, null, 300)
   ) as p(wkey, pos, key, n, reps, seconds)
   where p.wkey = w.key)
from (values
  ('base', 'Base (mobilidade, 8 min)'),
  ('ref',  'Reforço (ancas + ombro, 10 min)'),
  ('a',    'Ginásio A (pernas + empurrar)'),
  ('b',    'Ginásio B (puxar + unilateral)'),
  ('c',    'Ginásio C (potência + corpo inteiro)')
) as w(key, name)
on conflict (id) do update set
  name = excluded.name, rest_seconds = excluded.rest_seconds, exercises = excluded.exercises, archived = false;
