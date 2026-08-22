-- Syllabus content for the three IB DP core components, so TOK, EE, and CAS
-- are trackable instead of showing "Syllabus coming soon".
--
-- Structure follows the published DP core guides. Descriptive topic names only;
-- no guide text is reproduced.

BEGIN;

DELETE FROM syllabus_content
WHERE curriculum = 'IB'
  AND subject IN ('Theory of Knowledge', 'Extended Essay', 'Creativity Activity Service');

INSERT INTO syllabus_content (curriculum, subject, topic, subtopic, hl_only) VALUES

-- ===== Theory of Knowledge =============================================
('IB','Theory of Knowledge','Core theme','Knowledge and the knower',false),
('IB','Theory of Knowledge','Core theme','Personal versus shared knowledge',false),
('IB','Theory of Knowledge','Core theme','Values, beliefs, and perspective',false),

('IB','Theory of Knowledge','Optional themes','Knowledge and technology',false),
('IB','Theory of Knowledge','Optional themes','Knowledge and language',false),
('IB','Theory of Knowledge','Optional themes','Knowledge and politics',false),
('IB','Theory of Knowledge','Optional themes','Knowledge and religion',false),
('IB','Theory of Knowledge','Optional themes','Knowledge and indigenous societies',false),

('IB','Theory of Knowledge','Areas of knowledge','History as an area of knowledge',false),
('IB','Theory of Knowledge','Areas of knowledge','The human sciences',false),
('IB','Theory of Knowledge','Areas of knowledge','The natural sciences',false),
('IB','Theory of Knowledge','Areas of knowledge','Mathematics as an area of knowledge',false),
('IB','Theory of Knowledge','Areas of knowledge','The arts',false),

('IB','Theory of Knowledge','Knowledge framework','Scope of an area of knowledge',false),
('IB','Theory of Knowledge','Knowledge framework','Perspectives and context',false),
('IB','Theory of Knowledge','Knowledge framework','Methods and tools of enquiry',false),
('IB','Theory of Knowledge','Knowledge framework','Ethics in the production of knowledge',false),

('IB','Theory of Knowledge','Assessment','Selecting objects for the TOK exhibition',false),
('IB','Theory of Knowledge','Assessment','Writing the exhibition commentary',false),
('IB','Theory of Knowledge','Assessment','Unpacking a prescribed essay title',false),
('IB','Theory of Knowledge','Assessment','Building arguments and counterclaims',false),
('IB','Theory of Knowledge','Assessment','Using examples effectively in the essay',false),

-- ===== Extended Essay ==================================================
('IB','Extended Essay','Getting started','Choosing a subject for the essay',false),
('IB','Extended Essay','Getting started','Narrowing a topic to a viable scope',false),
('IB','Extended Essay','Getting started','Writing a focused research question',false),
('IB','Extended Essay','Getting started','Understanding subject-specific requirements',false),

('IB','Extended Essay','Research process','Planning the research timeline',false),
('IB','Extended Essay','Research process','Locating and evaluating sources',false),
('IB','Extended Essay','Research process','Primary versus secondary sources',false),
('IB','Extended Essay','Research process','Recording evidence and note taking',false),
('IB','Extended Essay','Research process','Research ethics and permissions',false),

('IB','Extended Essay','Writing','Structuring the introduction',false),
('IB','Extended Essay','Writing','Developing a sustained line of argument',false),
('IB','Extended Essay','Writing','Analysis versus description',false),
('IB','Extended Essay','Writing','Writing an effective conclusion',false),
('IB','Extended Essay','Writing','Formal register and academic voice',false),

('IB','Extended Essay','Referencing','Choosing and applying a citation style',false),
('IB','Extended Essay','Referencing','Building the bibliography',false),
('IB','Extended Essay','Referencing','Avoiding plagiarism and academic misconduct',false),

('IB','Extended Essay','Assessment criteria','Criterion A: Focus and method',false),
('IB','Extended Essay','Assessment criteria','Criterion B: Knowledge and understanding',false),
('IB','Extended Essay','Assessment criteria','Criterion C: Critical thinking',false),
('IB','Extended Essay','Assessment criteria','Criterion D: Presentation',false),
('IB','Extended Essay','Assessment criteria','Criterion E: Engagement and the RPPF',false),

('IB','Extended Essay','Supervision','Preparing for the first reflection session',false),
('IB','Extended Essay','Supervision','Preparing for the interim reflection',false),
('IB','Extended Essay','Supervision','The viva voce and final reflection',false),

-- ===== Creativity, Activity, Service ===================================
('IB','Creativity Activity Service','Strands','Creativity: exploring and extending ideas',false),
('IB','Creativity Activity Service','Strands','Activity: physical exertion and healthy lifestyle',false),
('IB','Creativity Activity Service','Strands','Service: collaborative and reciprocal engagement',false),
('IB','Creativity Activity Service','Strands','Balancing the three strands over 18 months',false),

('IB','Creativity Activity Service','Learning outcomes','Identifying own strengths and areas for growth',false),
('IB','Creativity Activity Service','Learning outcomes','Undertaking new challenges',false),
('IB','Creativity Activity Service','Learning outcomes','Planning and initiating activities',false),
('IB','Creativity Activity Service','Learning outcomes','Working collaboratively with others',false),
('IB','Creativity Activity Service','Learning outcomes','Showing perseverance and commitment',false),
('IB','Creativity Activity Service','Learning outcomes','Engaging with issues of global significance',false),
('IB','Creativity Activity Service','Learning outcomes','Recognising the ethics of choices and actions',false),

('IB','Creativity Activity Service','CAS project','Choosing a CAS project',false),
('IB','Creativity Activity Service','CAS project','Planning and delegating within the project',false),
('IB','Creativity Activity Service','CAS project','Carrying out and adapting the project',false),
('IB','Creativity Activity Service','CAS project','Evaluating project impact',false),

('IB','Creativity Activity Service','Portfolio','Maintaining the CAS portfolio',false),
('IB','Creativity Activity Service','Portfolio','Writing meaningful reflections',false),
('IB','Creativity Activity Service','Portfolio','Gathering evidence of engagement',false),
('IB','Creativity Activity Service','Portfolio','Preparing for the three CAS interviews',false);

COMMIT;
