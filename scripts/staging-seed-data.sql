-- ============================================================
-- AxeCode Staging E2E Seed Data
-- Idempotent SQL script to seed all entities required for full E2E testing
-- ============================================================

BEGIN;

-- 1. Clean up any previous seed data by fixed document_ids
DELETE FROM test_cases WHERE document_id LIKE 'tc_e2e_%';
DELETE FROM code_templates WHERE document_id LIKE 'ct_e2e_%';
DELETE FROM problems WHERE document_id = 'prob_e2e_palindrome';
DELETE FROM lessons WHERE document_id LIKE 'lesson_e2e_%';
DELETE FROM weeks WHERE document_id LIKE 'week_e2e_%';
DELETE FROM courses WHERE document_id = 'course_e2e_js';
DELETE FROM articles WHERE document_id = 'article_e2e_welcome';
DELETE FROM events WHERE document_id = 'event_e2e_meetup';
DELETE FROM roadmaps WHERE document_id = 'roadmap_e2e_frontend';
DELETE FROM tasks WHERE document_id LIKE 'task_e2e_%';
DELETE FROM projects WHERE document_id = 'project_e2e_portal';

-- Ensure Public (2) and Authenticated (1) have find/findOne for catalog browsing
INSERT INTO up_permissions_role_lnk (permission_id, role_id)
SELECT p.id, 2
FROM up_permissions p
WHERE p.action IN (
  'api::problem.problem.find',
  'api::problem.problem.findOne',
  'api::course.course.find',
  'api::course.course.findOne',
  'api::article.article.find',
  'api::article.article.findOne',
  'api::event.event.find',
  'api::event.event.findOne',
  'api::roadmap.roadmap.find',
  'api::roadmap.roadmap.findOne',
  'api::project.project.find',
  'api::project.project.findOne'
)
ON CONFLICT DO NOTHING;

-- 2. Seed Problem: Valid Palindrome
INSERT INTO problems (
  document_id, title, slug, difficulty,
  description, constraints, examples, hints,
  function_name, function_params, return_type,
  time_limit, memory_limit, is_draft, public,
  created_at, updated_at, published_at
) VALUES (
  'prob_e2e_palindrome',
  'Valid Palindrome',
  'valid-palindrome',
  'easy',
  '[{"type":"paragraph","children":[{"text":"A phrase is a palindrome if it reads the same forward and backward."}]}]'::jsonb,
  '1 <= s.length <= 2 * 10^5',
  '[{"input":"s = \"racecar\"","output":"true","explanation":"\"racecar\" is a palindrome."},{"input":"s = \"hello\"","output":"false","explanation":"\"hello\" is not a palindrome."}]'::jsonb,
  '["Compare the string with its reversed version."]'::jsonb,
  'isPalindrome',
  '[{"name":"s","type":"string"}]'::jsonb,
  'boolean',
  2000,
  256000,
  false,
  true,
  NOW(), NOW(), NOW()
);

-- 3. Seed Test Cases
INSERT INTO test_cases (
  document_id, input, expected_output, is_hidden, "order",
  created_at, updated_at, published_at
) VALUES 
(
  'tc_e2e_palindrome_1',
  '{"s":"racecar"}'::jsonb,
  'true'::jsonb,
  false,
  1,
  NOW(), NOW(), NOW()
),
(
  'tc_e2e_palindrome_2',
  '{"s":"hello"}'::jsonb,
  'false'::jsonb,
  false,
  2,
  NOW(), NOW(), NOW()
);

-- Link Test Cases to Problem
INSERT INTO test_cases_problem_lnk (test_case_id, problem_id, test_case_ord)
SELECT tc.id, p.id, 1.0
FROM test_cases tc, problems p
WHERE tc.document_id = 'tc_e2e_palindrome_1' AND p.document_id = 'prob_e2e_palindrome';

INSERT INTO test_cases_problem_lnk (test_case_id, problem_id, test_case_ord)
SELECT tc.id, p.id, 2.0
FROM test_cases tc, problems p
WHERE tc.document_id = 'tc_e2e_palindrome_2' AND p.document_id = 'prob_e2e_palindrome';

-- 4. Seed Code Template (JavaScript)
INSERT INTO code_templates (
  document_id, language, starter_code, wrapper_code,
  created_at, updated_at, published_at
) VALUES (
  'ct_e2e_palindrome_js',
  'javascript',
  'function isPalindrome(s) {
  // Write your code here
  return s === s.split('''').reverse().join('''');
}',
  '{IMPORTS}
{COMMON_CLASSES}
{SERIALIZERS}
{USER_CODE}

const fs = require(''fs'');
const input = fs.readFileSync(0, ''utf-8'');
{PARAM_ASSIGNMENTS}
const result = {INVOCATION};
console.log("{DELIMITER}");
console.log(JSON.stringify(serialize(result)));',
  NOW(), NOW(), NOW()
);

-- Link Code Template to Problem
INSERT INTO code_templates_problem_lnk (code_template_id, problem_id, code_template_ord)
SELECT ct.id, p.id, 1.0
FROM code_templates ct, problems p
WHERE ct.document_id = 'ct_e2e_palindrome_js' AND p.document_id = 'prob_e2e_palindrome';

-- 5. Seed Course
INSERT INTO courses (
  document_id, title, difficulty, is_draft,
  description, tags, engagement_score,
  created_at, updated_at, published_at
) VALUES (
  'course_e2e_js',
  'JavaScript Fundamentals',
  'easy',
  false,
  '[{"type":"paragraph","children":[{"text":"Master the core concepts of modern JavaScript with hands-on practice."}]}]'::jsonb,
  '["javascript","web"]'::jsonb,
  100,
  NOW(), NOW(), NOW()
);

-- 6. Seed Week
INSERT INTO weeks (
  document_id, is_draft,
  created_at, updated_at, published_at
) VALUES (
  'week_e2e_01',
  false,
  NOW(), NOW(), NOW()
);

-- Link Week to Course
INSERT INTO weeks_course_lnk (week_id, course_id, week_ord)
SELECT w.id, c.id, 1.0
FROM weeks w, courses c
WHERE w.document_id = 'week_e2e_01' AND c.document_id = 'course_e2e_js';

-- 7. Seed Lesson
INSERT INTO lessons (
  document_id, title, is_draft, public, duration,
  type_of_lesson, description, is_completed,
  created_at, updated_at, published_at
) VALUES (
  'lesson_e2e_01',
  'Variables and Data Types',
  false,
  true,
  15,
  'lecture',
  '[{"type":"paragraph","children":[{"text":"In this lesson, you will learn about let, const, and JavaScript primitives."}]}]'::jsonb,
  false,
  NOW(), NOW(), NOW()
);

-- Link Lesson to Week
INSERT INTO lessons_week_lnk (lesson_id, week_id, lesson_ord)
SELECT l.id, w.id, 1.0
FROM lessons l, weeks w
WHERE l.document_id = 'lesson_e2e_01' AND w.document_id = 'week_e2e_01';

-- 8. Seed Article
INSERT INTO articles (
  document_id, title, is_draft, tags,
  content_blocks, engagement_score,
  created_at, updated_at, published_at
) VALUES (
  'article_e2e_welcome',
  'Welcome to AxeCode Community',
  false,
  '["welcome","community"]'::jsonb,
  '[{"type":"paragraph","children":[{"text":"Welcome to the official developer community! Share code, solve challenges, and grow."}]}]'::jsonb,
  50,
  NOW(), NOW(), NOW()
);

-- 9. Seed Event
INSERT INTO events (
  document_id, title, is_draft, onsite,
  location, duration, discription, tags,
  date, created_at, updated_at, published_at
) VALUES (
  'event_e2e_meetup',
  'AxeCode Code-a-thon 2026',
  false,
  false,
  'Online Discord',
  120,
  '[{"type":"paragraph","children":[{"text":"Join our annual coding challenge with fellow developers!"}]}]'::jsonb,
  '["hackathon","competition"]'::jsonb,
  NOW() + interval '7 days',
  NOW(), NOW(), NOW()
);

-- 10. Seed Roadmap
INSERT INTO roadmaps (
  document_id, title, is_draft, color, icon,
  description, tags,
  created_at, updated_at, published_at
) VALUES (
  'roadmap_e2e_frontend',
  'Frontend Developer Pathway',
  false,
  '#00D26A',
  'code',
  '[{"type":"paragraph","children":[{"text":"The complete step-by-step roadmap to modern frontend mastery."}]}]'::jsonb,
  '["frontend","react"]'::jsonb,
  NOW(), NOW(), NOW()
);

-- 11. Seed Project
INSERT INTO projects (
  document_id, title, status, visibility,
  description, tags, engagement_score,
  created_at, updated_at, published_at
) VALUES (
  'project_e2e_portal',
  'AxeCode Community Portal',
  'active',
  'public',
  '[{"type":"paragraph","children":[{"text":"An open source web application built by the AxeCode community."}]}]'::jsonb,
  '["opensource","react","nodejs"]'::jsonb,
  10,
  NOW(), NOW(), NOW()
);

-- 12. Seed Task
INSERT INTO tasks (
  document_id, title, description, status,
  priority, "order",
  created_at, updated_at, published_at
) VALUES (
  'task_e2e_theme',
  'Implement Dark Theme Switcher',
  'Add high-contrast dark theme toggle with localStorage persistence.',
  'backlog',
  'high',
  1,
  NOW(), NOW(), NOW()
);

-- Link Task to Project
INSERT INTO tasks_project_lnk (task_id, project_id)
SELECT t.id, p.id
FROM tasks t, projects p
WHERE t.document_id = 'task_e2e_theme' AND p.document_id = 'project_e2e_portal';

-- 13. Ensure User has Wallet
DO $$
DECLARE
  v_user_id integer;
  v_wallet_id integer;
BEGIN
  SELECT id INTO v_user_id FROM up_users ORDER BY id ASC LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    SELECT w.id INTO v_wallet_id 
    FROM wallets w 
    JOIN wallets_owner_lnk l ON w.id = l.wallet_id 
    WHERE l.user_id = v_user_id;

    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (
        document_id, owner_type, balance, pending_balance,
        currency, is_active, version, created_at, updated_at, published_at
      ) VALUES (
        'wallet_e2e_user_' || v_user_id,
        'user',
        750.00,
        50.00,
        'EGP',
        true,
        1,
        NOW(), NOW(), NOW()
      ) RETURNING id INTO v_wallet_id;

      INSERT INTO wallets_owner_lnk (wallet_id, user_id) VALUES (v_wallet_id, v_user_id);
    ELSE
      UPDATE wallets SET balance = 750.00, pending_balance = 50.00, is_active = true WHERE id = v_wallet_id;
    END IF;
  END IF;
END $$;

COMMIT;
