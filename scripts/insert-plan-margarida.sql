-- Insere o plano semanal (Força A/B, Yoga + Pilates, Cardio) na conta Goalbud
-- de margaridamccferreira@gmail.com.
--
-- Como correr: Supabase dashboard → SQL editor → colar tudo e executar
-- (ou: psql "$DATABASE_URL" -f scripts/insert-plan-margarida.sql).
--
-- SQL simples, sem blocos DO nem funções, para o editor do dashboard não se
-- atrapalhar. O e-mail aparece 3 vezes (uma por insert): muda-o em todas se
-- necessário. O script é idempotente: os ids são derivados de chaves fixas
-- (com o prefixo "goalbud:margarida:" para nunca colidir com o plano de outra
-- conta), por isso voltar a correr actualiza em vez de duplicar. Sessões e
-- entradas já registadas nunca são tocadas.
--
-- O que cria:
--   Goals    Força (25 min)                    seg/sex, exercise goal: abre o workout picker e fica feito ao terminar a sessão
--            Yoga + Pilates                    ter/qui
--            Cardio (20 min, ritmo de conversa) qua
--            Intervalos: 4 x (1 min forte / 2 min leve)
--                                              qua, de 2 em 2 semanas a partir da semana 5 (semana 1 = esta semana);
--                                              é o bloco a meter no meio do cardio de quarta, por isso é um goal
--                                              separado que só aparece nesses dias
--   Workouts Força A (segunda) · Força B (sexta)
--   Cada workout = aquecimento (3 min) + circuito + cardio forte (6-7 min).
--   Circuito: 3 voltas. Na app cada exercício do circuito tem 3 séries (uma por
--   volta) e descanso 0; o último exercício de cada volta (prancha / saltos) tem
--   30 s de descanso, que é a pausa entre voltas. Faz-se uma série de cada
--   exercício por volta, pela ordem em que aparecem.
--   Pesos ficam vazios; preenche na primeira sessão. "(por lado)" / "(por perna)"
--   no nome = repetir a série de cada lado.
--   Os workouts ficam sem descanso próprio (null) para valer o descanso de cada exercício.
--
-- Se o e-mail não existir em auth.users, o primeiro insert falha com
-- "null value in column user_id", que é o sinal para corrigir o e-mail.

------------------------------------------------------------------ 1. goals
-- schedule: uma versão a partir da segunda-feira desta semana (a semana começa à segunda).
-- Os intervalos usam "everyN" (de 14 em 14 dias) ancorado na quarta-feira da semana 5.
insert into public.goals (id, user_id, name, shape, colour, icon, is_exercise, state, parent_id, schedule, target_date, created_on, sort_order)
select
  md5('goalbud:margarida:goal:' || g.key)::uuid,
  (select id from auth.users where lower(email) = lower('margaridamccferreira@gmail.com')),
  g.name, g.shape, g.colour, g.icon, g.is_exercise, 'active',
  null::uuid,
  jsonb_build_array(g.version || jsonb_build_object('from', date_trunc('week', current_date)::date)),
  null::date,
  current_date,
  g.sort_order
from (values
  -- (chave, nome, shape, cor, ícone, exercise?, versão do horário, ordem)
  ('forca', 'Força (25 min)', 'scheduled', 'rust', 'diamond', true,
    '{"recurrence": {"kind": "weekdays", "days": [1, 5]}}'::jsonb, 0),
  ('yoga', 'Yoga + Pilates', 'scheduled', 'sage', 'leaf', false,
    '{"recurrence": {"kind": "weekdays", "days": [2, 4]}}', 1),
  ('cardio', 'Cardio (20 min, ritmo de conversa)', 'scheduled', 'teal', 'wave', false,
    '{"recurrence": {"kind": "weekdays", "days": [3]}}', 2),
  ('intervalos', 'Intervalos: 4 x (1 min forte / 2 min leve)', 'scheduled', 'gold', 'bars', false,
    jsonb_build_object('recurrence', jsonb_build_object('kind', 'everyN', 'n', 14,
      'anchor', (date_trunc('week', current_date)::date + interval '4 weeks 2 days')::date)), 3)
) as g(key, name, shape, colour, icon, is_exercise, version, sort_order)
on conflict (id) do update set
  name = excluded.name, shape = excluded.shape, colour = excluded.colour, icon = excluded.icon,
  is_exercise = excluded.is_exercise, parent_id = excluded.parent_id, schedule = excluded.schedule,
  target_date = excluded.target_date, sort_order = excluded.sort_order;

-------------------------------------------------------------- 2. exercises
-- (chave, nome, tipo, descanso em segundos; 0 = sem temporizador)
insert into public.exercises (id, user_id, name, kind, rest_seconds)
select
  md5('goalbud:margarida:exercise:' || e.key)::uuid,
  (select id from auth.users where lower(email) = lower('margaridamccferreira@gmail.com')),
  e.name, e.kind, e.rest
from (values
  -- Aquecimento (3 min, comum aos dois dias)
  ('marcha', 'Marcha no lugar', 'time', 0),
  ('agachlivre', 'Agachamentos sem peso', 'reps', 0),
  ('rotanca', 'Rotações de anca (por lado)', 'reps', 0),
  -- Circuito A
  ('goblet', 'Agachamento com haltere ao peito', 'reps', 0),
  ('flexoes', 'Flexões (joelhos no chão)', 'reps', 0),
  ('remada', 'Remada com haltere (por lado)', 'reps', 0),
  ('prancha', 'Prancha', 'time', 30),
  -- Circuito B
  ('rdl', 'Peso morto romeno', 'reps', 0),
  ('lunges', 'Lunges para trás (por perna)', 'reps', 0),
  ('press', 'Press de ombros', 'reps', 0),
  ('saltos', 'Saltos à corda ou no lugar', 'time', 30),
  -- Cardio final (comum aos dois dias)
  ('cardioforte', 'Cardio a ritmo forte, sem parar: corda, bicicleta ou escadas', 'time', 0)
) as e(key, name, kind, rest)
on conflict (id) do update set
  name = excluded.name, kind = excluded.kind, rest_seconds = excluded.rest_seconds, archived = false;

--------------------------------------------------------------- 3. workouts
-- (workout, ordem, exercício, séries, reps | null, segundos | null)
insert into public.workouts (id, user_id, name, rest_seconds, exercises)
select
  md5('goalbud:margarida:workout:' || w.key)::uuid,
  (select id from auth.users where lower(email) = lower('margaridamccferreira@gmail.com')),
  w.name, null,
  (select jsonb_agg(
      jsonb_build_object(
        'exerciseId', md5('goalbud:margarida:exercise:' || p.key)::uuid,
        'sets', (select jsonb_agg(s.obj) from (
                   select jsonb_build_object('reps', p.reps, 'weight', null, 'seconds', p.seconds) as obj
                   from generate_series(1, p.n)) s))
      order by p.pos)
   from (values
     -- Força A (segunda): aquecimento 3 min + circuito 3 voltas + cardio 6-7 min
     ('a', 1, 'marcha',      1, null, 60),
     ('a', 2, 'agachlivre',  1, 10,   null),
     ('a', 3, 'rotanca',     1, 10,   null),
     ('a', 4, 'goblet',      3, 10,   null),
     ('a', 5, 'flexoes',     3, 8,    null),
     ('a', 6, 'remada',      3, 10,   null),
     ('a', 7, 'prancha',     3, null, 30),   -- 30 s de descanso = pausa entre voltas
     ('a', 8, 'cardioforte', 1, null, 420),  -- 7 min
     -- Força B (sexta): mesmo aquecimento e cardio, circuito diferente
     ('b', 1, 'marcha',      1, null, 60),
     ('b', 2, 'agachlivre',  1, 10,   null),
     ('b', 3, 'rotanca',     1, 10,   null),
     ('b', 4, 'rdl',         3, 10,   null),
     ('b', 5, 'lunges',      3, 8,    null),
     ('b', 6, 'press',       3, 10,   null),
     ('b', 7, 'saltos',      3, null, 45),   -- 30 s de descanso = pausa entre voltas
     ('b', 8, 'cardioforte', 1, null, 420)   -- 7 min
   ) as p(wkey, pos, key, n, reps, seconds)
   where p.wkey = w.key)
from (values
  ('a', 'Força A (segunda, 25 min)'),
  ('b', 'Força B (sexta, 25 min)')
) as w(key, name)
on conflict (id) do update set
  name = excluded.name, rest_seconds = excluded.rest_seconds, exercises = excluded.exercises, archived = false;
