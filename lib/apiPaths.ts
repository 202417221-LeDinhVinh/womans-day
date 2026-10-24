// Shared API path helpers.

export const API_PATHS = {
  // Static routes
  QUESTIONS: "/api/questions",
  QUESTIONS_BULK: "/api/questions/bulk",
  RESULTS: "/api/results",
  USER_SETTINGS: "/api/user/settings",
  USER_DASHBOARD: "/api/user/dashboard",
  USER_ANALYTICS: "/api/user/analytics",
  USER_ADVANCED_ANALYTICS: "/api/user/advanced-analytics",
  // Todo: ONE personal task list (managed by the student, by Ask Rob, and by the
  // homework sync). A task with a due date is a "reminder" and fires a web-push
  // when it passes. Per-item routes take an id.
  TODOS: "/api/todo/todos",
  getTodo: (id: string) => `/api/todo/todos/${encodeURIComponent(id)}`,
  // Register/refresh this browser's web-push subscription (PWA push delivery).
  TODO_PUSH_SUBSCRIBE: "/api/todo/push/subscribe",
  // Drop this browser's web-push subscription (turn push off for the device).
  TODO_PUSH_UNSUBSCRIBE: "/api/todo/push/unsubscribe",
  // The server's VAPID public key, for the client to subscribe against.
  TODO_PUSH_PUBLIC_KEY: "/api/todo/push/public-key",
  // Send a verification test push to the caller's own devices (banner uses it to
  // confirm end-to-end delivery before it clears).
  TODO_PUSH_TEST: "/api/todo/push/test",
  // Notes sub-app (/notes): rich-text notes + notebooks (folders). All routes are
  // owner-scoped. Note images live in a dedicated R2 bucket and count toward the
  // per-user cloud-storage quota (100 MB free / 1 GB Advanced).
  NOTES: "/api/notes",
  getNote: (id: string) => `/api/notes/${encodeURIComponent(id)}`,
  // Lookup for the Error Log record dialog: the (at most one) active note
  // linked to a given resultId+questionId, via ?resultId=&questionId=.
  NOTES_LINKED_ERROR_LOG: "/api/notes/linked-error-log",
  // Trashed notes (the Bin) + bulk trash/restore/purge actions.
  NOTES_BIN: "/api/notes/bin",
  NOTES_BULK: "/api/notes/bulk",
  // Bulk-read full note bodies for a set of ids (grid body prefetch).
  NOTES_BODIES: "/api/notes/bodies",
  NOTEBOOKS: "/api/notes/notebooks",
  getNotebook: (id: string) => `/api/notes/notebooks/${encodeURIComponent(id)}`,
  // Upload one pasted/dropped image (quota-gated) → { url, objectKey, byteSize }.
  NOTES_IMAGE_UPLOAD: "/api/notes/images/upload",
  // Owner-scoped image serving route; `objectKey` is the R2 key from an upload.
  getNoteImage: (objectKey: string) =>
    `/api/notes/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  // The caller's cloud-storage usage + tier ceiling (account popover limit row).
  NOTES_STORAGE: "/api/notes/storage",
  // SAT Document Hub (/docs, memory/0.3/481). Public catalog + metadata are optional-auth;
  // search, pages, downloads and every mutation require an active session. Locked pages
  // are 403 server-side and never in the DOM (a blur is not a gate).
  DOC_STORE: "/api/docs",
  DOC_STORE_UPLOAD: "/api/docs/upload",
  DOC_STORE_SEARCH: "/api/docs/search",
  DOC_STORE_MINE: "/api/docs/mine",
  DOC_STORE_ALLOWANCE: "/api/docs/my-allowance",
  getDocStoreItem: (id: string) => `/api/docs/${encodeURIComponent(id)}`,
  getDocStoreThumb: (id: string, version: string) =>
    `/api/docs/${encodeURIComponent(id)}/thumb?v=${encodeURIComponent(version)}`,
  getDocStorePage: (id: string, pageNumber: number) =>
    `/api/docs/${encodeURIComponent(id)}/page/${pageNumber}`,
  getDocStoreUnlock: (id: string) => `/api/docs/${encodeURIComponent(id)}/unlock`,
  getDocStoreDownload: (id: string) => `/api/docs/${encodeURIComponent(id)}/download`,
  getDocStoreFile: (id: string) => `/api/docs/${encodeURIComponent(id)}/file`,
  getDocStoreVote: (id: string) => `/api/docs/${encodeURIComponent(id)}/vote`,
  getDocStoreReport: (id: string) => `/api/docs/${encodeURIComponent(id)}/report`,
  // Whiteboard sub-app (/whiteboard): folders hold boards, a board holds one scene
  // (strokes, shapes, text, images). Every route is owner-scoped, and each returns the
  // caller's tier ceilings alongside the data so the grid can raise the upsell without
  // a second round trip. Board images live in a dedicated R2 bucket (WHITEBOARD_BUCKET)
  // and are served only through the owner-scoped route below.
  WHITEBOARD_FOLDERS: "/api/whiteboard/folders",
  // The whole library in one read (every folder + every board summary with its scene
  // version, no scenes) — the local-first client's change detector.
  WHITEBOARD_LIBRARY: "/api/whiteboard/library",
  getWhiteboardFolder: (id: string) => `/api/whiteboard/folders/${encodeURIComponent(id)}`,
  // The boards inside one folder, plus that folder's own row (the breadcrumb needs it).
  getWhiteboardFolderBoards: (id: string) =>
    `/api/whiteboard/folders/${encodeURIComponent(id)}/boards`,
  WHITEBOARD_BOARDS: "/api/whiteboard/boards",
  // GET loads the scene, PATCH applies a version-locked scene patch, DELETE removes the
  // board and purges its R2 objects first.
  getWhiteboardBoard: (id: string) => `/api/whiteboard/boards/${encodeURIComponent(id)}`,
  // Title/background/colour edits. SEPARATE from the patch route on purpose: a rename
  // must not collide with an in-flight delta save under the version lock.
  getWhiteboardBoardMeta: (id: string) => `/api/whiteboard/boards/${encodeURIComponent(id)}/meta`,
  // Upload one pasted/dropped image onto a board (quota-gated) → { url, objectKey, ... }.
  getWhiteboardBoardImages: (id: string) =>
    `/api/whiteboard/boards/${encodeURIComponent(id)}/images`,
  // Owner-scoped image serving route; `objectKey` is the R2 key from an upload. Same
  // segment-wise encoding as `getNoteImage` — the key contains slashes that must stay
  // path separators.
  getWhiteboardImage: (objectKey: string) =>
    `/api/whiteboard/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  // The caller's booklet-PDF download usage against their weekly + monthly
  // ceilings. Read-only display for the settings Quotas section; the ENFORCING
  // check lives in pdfAssetService.getPdfDownload.
  USER_PDF_DOWNLOADS: "/api/user/pdf-downloads",
  // IELTS Writing grader (/ielts-writing). An agentic grading pipeline on the Ask
  // Rob AI backend — see memory/0.3/234-ielts-writing-grader.md.
  //
  // GRADE is an SSE stream of typed PIPELINE STAGE events (not tokens, and not the
  // AI SDK message stream): each stage reports a title + a plain-language summary
  // as it lands, so the student watches the grader reason. Bands ride the stream
  // but are withheld client-side until the pre-reveal estimate is submitted.
  IELTS_WRITING_GRADE: "/api/ielts-writing/grade",
  // One submission's full report (bands, criteria, findings, feedback). Owner-scoped.
  getIeltsWritingSubmission: (id: string) =>
    `/api/ielts-writing/submissions/${encodeURIComponent(id)}`,
  // One submission's INPUT — prompt, essay and archived photos per task. Owner-scoped.
  // The RESUME read, and separate from the report on purpose: a report only projects
  // GRADED tasks, so mid-grade it carries no prompt and no essay, which is why a
  // recovered session used to show its progress over an empty deck.
  getIeltsWritingSubmissionInput: (id: string) =>
    `/api/ielts-writing/submissions/${encodeURIComponent(id)}/input`,
  // The grading narration for one check, after a cursor. Owner-scoped. This is the
  // transport that replaces the SSE grade stream: `afterSeq` is the client's memory,
  // so a reload, a new tab, a flaky connection and a deploy are all the same request.
  // `afterSeq=-1` (the default) reads from the beginning, which is what restoring a
  // returning student's screen asks for; a live poller passes the highest seq applied.
  getIeltsWritingEvents: (id: string, afterSeq: number) =>
    `/api/ielts-writing/submissions/${encodeURIComponent(id)}/events?afterSeq=${afterSeq}`,
  // Withdraw a QUEUED check (never a running one). Refunds the weekly allowance it was
  // charged and records `cancelled` rather than `failed` — nothing broke, the student
  // withdrew it, and the row is the audit trail.
  getIeltsWritingCancel: (id: string) =>
    `/api/ielts-writing/submissions/${encodeURIComponent(id)}/cancel`,
  // Re-run a FAILED grade on the essay already stored against this submission. Not a second
  // check: `failed` is the refund state, so the student still holds the allowance, and this
  // regrades the existing row rather than reserving a new one. Retryable for 7 days
  // (`lib/limits/checkRetry.ts`); the grade route has no other per-submission start.
  getIeltsWritingRetry: (id: string) =>
    `/api/ielts-writing/submissions/${encodeURIComponent(id)}/retry`,
  // The caller's submissions, newest first — merged into the /review timeline the
  // way adaptive attempts are.
  IELTS_WRITING_SUBMISSIONS: "/api/ielts-writing/submissions",
  // Self-assessment surveys: the once-per-account intake, and the per-submission
  // pre-reveal estimate. GET reports whether the intake is still outstanding.
  IELTS_WRITING_SELF_ASSESSMENT: "/api/ielts-writing/self-assessment",
  // Owner-scoped image serving; `objectKey` is the R2 key from a graded submission.
  // Bytes expire after 7 days via a bucket lifecycle rule, so this 404s after that.
  getIeltsWritingImage: (objectKey: string) =>
    `/api/ielts-writing/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  // The caller's weekly writing-check usage against their tier ceiling. Read-only
  // display for the settings Quotas section; the ENFORCING check lives in
  // writingGradeLimitService.reserve.
  USER_WRITING_GRADES: "/api/user/writing-grades",

  // IELTS Speaking (/ielts-speaking) — record an interview, get measured acoustics and
  // per-criterion descriptor evidence. See memory/0.3/246-ielts-speaking.md.
  //
  // The shape differs from Writing in one way that matters: audio is uploaded PER
  // ANSWER, one whole-body PUT each, because every R2 write in this codebase buffers
  // the request body in the Worker and a whole interview in one request would be both
  // a fat buffer and an all-or-nothing upload. Each answer is durable the moment it
  // lands, so a dropped connection costs one answer, not the session.
  IELTS_SPEAKING_SUBMISSIONS: "/api/ielts-speaking/submissions",
  getIeltsSpeakingSubmission: (id: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(id)}`,
  // Register one answer slot (part, order, prompt) before its bytes exist. Returns the
  // answer id the upload PUT then targets.
  getIeltsSpeakingAnswers: (submissionId: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(submissionId)}/answers`,
  // PUT the recorded bytes for one answer; GET streams them back for playback. GET
  // supports a single HTTP byte range and is `private, no-store` — the object key is
  // never exposed, exactly like the private Listening master. 404s once the 90-day
  // audio clock has passed, even though the analysis and the report survive.
  getIeltsSpeakingAnswerAudio: (answerId: string) =>
    `/api/ielts-speaking/answers/${encodeURIComponent(answerId)}/audio`,
  // Hand the finished recording set to the analysis pipeline. This is the metered
  // gesture: one call, one check against the weekly allowance.
  getIeltsSpeakingAnalyse: (submissionId: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(submissionId)}/analyse`,
  // Cursor-paginated progress log, NOT a stream. On Cloudflare an HTTP-triggered
  // Worker's lifetime is its response's lifetime, so a client abort on unmount would
  // kill the run — the mistake the Writing grader made once and documented in
  // lib/services/ieltsWritingClient.ts. `afterSeq` is the last row id seen; -1 replays
  // from the beginning, which is also how a reload resumes.
  getIeltsSpeakingEvents: (id: string, afterSeq: number) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(id)}/events?afterSeq=${afterSeq}`,
  getIeltsSpeakingCancel: (id: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(id)}/cancel`,
  // Re-run a FAILED analysis on the audio already stored against this submission — the twin of
  // the analyse route, not a loosening of it (that one gates hard on `pending`, because it is the
  // hand-in gesture and may fire exactly once). Retryable for 7 days and only while the
  // recordings survive (`lib/limits/checkRetry.ts`).
  getIeltsSpeakingRetry: (id: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(id)}/retry`,
  // The check's planned main questions: POST stores the script the candidate accepted
  // (write-once, right after the check opens); GET reads it back for a resumed room.
  getIeltsSpeakingPlan: (id: string) =>
    `/api/ielts-speaking/submissions/${encodeURIComponent(id)}/plan`,
  // Compose a custom topic's main questions BEFORE any check exists — the planner
  // screen's "Generate with Rob". Generates and returns; nothing persists until the
  // candidate accepts and the plan is stored through getIeltsSpeakingPlan.
  IELTS_SPEAKING_PREVIEW: "/api/ielts-speaking/questions/preview",
  // The calibration survey. POST the once-per-account intake (which carries any REAL
  // IELTS Speaking band the student has been awarded — the only absolute anchor this
  // instrument has) or the per-check pre-reveal guess, which is what unlocks the bands.
  IELTS_SPEAKING_SELF_ASSESSMENT: "/api/ielts-speaking/self-assessment",
  // The caller's weekly speaking-check usage against their tier ceiling. Read-only
  // display; the ENFORCING check lives in speakingCheckLimitService.reserve.
  USER_SPEAKING_CHECKS: "/api/user/speaking-checks",

  USER_PASSWORD: "/api/user/password",
  USER_ONBOARDING: "/api/user/onboarding",
  USER_USERNAME: "/api/user/username",
  DEV_ONBOARDING_RESET: "/api/dev/onboarding",
  DEV_TEAM_WORK_SEED: "/api/dev/team-work-seed",
  DEV_IMPORT_ADAPTIVE_RESULT: "/api/dev/import-adaptive-result",
  DEV_IMPORT_TEST_HISTORY: "/api/dev/import-test-history",
  DEV_BOOT_TOKEN: "/api/dev/boot-token",
  DEV_SPEAKING_ACOUSTICS_PROBE: "/api/dev/speaking-acoustics-probe",
  DEV_SPEAKING_ACCENT_RESUBMIT: "/api/dev/speaking-accent-resubmit",
  USER_VOCAB_BOARD: "/api/user/vocab-board",
  USER_VOCAB_REVIEW: "/api/user/vocab-board/review",
  USER_VOCAB_STATS: "/api/user/vocab-board/stats",
  USER_REVIEW_REASONS: "/api/user/review-reasons",
  // Per-user single-select catalogs for the Error Log's Domain/Skill/
  // Difficulty properties (see lib/reviewPropertyCatalog.ts) — same shape as
  // USER_REVIEW_REASONS, one route per property.
  USER_REVIEW_DOMAINS: "/api/user/review-domains",
  USER_REVIEW_SKILLS: "/api/user/review-skills",
  USER_REVIEW_DIFFICULTIES: "/api/user/review-difficulties",
  VOCAB_DICTIONARY: "/api/vocab/dictionary",
  // Word Wise word resolution for obfuscated question text: ONE word per call, addressed by
  // field key + index (see memory/0.3/240-question-payload-obfuscation.md §7.1).
  WORDWISE_RESOLVE: "/api/wordwise/resolve",
  // Ask Rob AI assistant (the standalone /ask-rob tab).
  ASK_ROB_STREAM: "/api/ask-rob/stream",
  ASK_ROB_CONVERSATIONS: "/api/ask-rob/conversations",
  ASK_ROB_CREDITS: "/api/ask-rob/credits",
  // Spend one early-reset token: clears the caller's rolling window for a fresh
  // full 24h quota (self-scoped, costs one banked reset).
  ASK_ROB_CREDITS_RESET: "/api/ask-rob/credits/reset",
  ASK_ROB_PERSONA: "/api/ask-rob/persona",
  // Rob's memory GRAPH (nodes + edges) for the review canvas. `?view=changes`
  // returns the newest-first node event log instead of the live graph.
  ASK_ROB_GRAPH: "/api/ask-rob/graph",
  ASK_ROB_CHECK_ANSWER: "/api/ask-rob/check-answer",
  ASK_ROB_ARTIFACTS: "/api/ask-rob/artifacts",
  // Key-free snapshot behind an inline show_question card (self-fetched on mount,
  // so live + reload render identically). The answer key never reaches here.
  ASK_ROB_QUESTION: "/api/ask-rob/question",
  // Summarize a long thread to free context room (the /compact slash command).
  ASK_ROB_COMPACT: "/api/ask-rob/compact",
  // Rate one assistant reply 👍/👎 (owner-scoped; a re-rate replaces the prior one,
  // and clearing removes it). Feeds the admin "AI analytics" feedback aggregate.
  ASK_ROB_FEEDBACK: "/api/ask-rob/feedback",
  // Switch the active branch of a conversation (regenerate/edit versions). POSTs the
  // sibling message id to activate; the server resolves its branch tip + repoints.
  getAskRobBranch: (conversationId: string) =>
    `/api/ask-rob/conversations/${encodeURIComponent(conversationId)}/branch`,
  TEST_MANAGER_TESTS: "/api/test-manager/tests",
  TEST_MANAGER_NEXT_QUESTION: "/api/test-manager/next-question",
  TEST_MANAGER_LOCKED_TESTS: "/api/test-manager/locked-tests",
  TEST_MANAGER_REPORTS: "/api/test-manager-reports",
  GROUPS: "/api/groups",
  GROUPS_ACCESS: "/api/groups/access",
  GROUPS_JOIN_CODE: "/api/groups/join-code",
  GROUP_SESSIONS: "/api/groups/sessions",
  GROUP_SESSIONS_ACTIVE: "/api/groups/sessions/active",
  TEAM_WORK_LOBBIES: "/api/team-work/lobbies",
  TEAM_WORK_AVAILABLE: "/api/team-work/lobbies?scope=available",
  // Weekly league (the tournament). Every route is SELF-ONLY: the cohort and the
  // standing are resolved from the session user id, never from a parameter, so a
  // caller cannot enumerate cohorts or read another student's XP. The board is
  // null for a student who has not competed this season; the profile is always
  // populated - a student who has never competed reads as the bottom of the
  // ladder with zeros. The season result is the caller's frozen outcome for the
  // week that just closed (null until their cohort settles).
  LEAGUE_BOARD: "/api/league/board",
  LEAGUE_PROFILE: "/api/league/profile",
  LEAGUE_SEASON_RESULT: "/api/league/season-result",
  RESULT_REASON: "/api/results/reason",
  RESULT_ANALYSIS: "/api/results/analysis",
  // Single-value Domain/Skill/Difficulty override PATCH endpoints — distinct
  // from RESULT_REASON (multi-value) and RESULT_ANALYSIS (free text).
  RESULT_DOMAIN: "/api/results/domain",
  RESULT_SKILL: "/api/results/skill",
  RESULT_DIFFICULTY: "/api/results/difficulty",
  RESULT_ERROR_LOG: "/api/results/error-log",
  RESULT_ERROR_LOG_SYNC: "/api/results/error-log/sync",
  RESULT_ERROR_LOG_FILTER_OPTIONS: "/api/results/error-log/filter-options",
  TEST_ACCESS: "/api/test-access",
  // "Is there a live giveaway event on this test?" — asked by the token dialog only,
  // AFTER a student has pressed a locked test. Keeping it out of the catalog render
  // means the hottest read in the app gains no extra query: a card the student never
  // presses never asks.
  testAccessEvents: (testId: string) =>
    `/api/test-access/events?testId=${encodeURIComponent(testId)}`,
  TEST_SESSION_HEARTBEAT: "/api/test-sessions/heartbeat",
  TEST_SESSION_MATERIAL: "/api/test-sessions/material",
  TEST_SESSIONS_ACTIVE: "/api/test-sessions/active",
  TEST_SESSIONS_CLEAR: "/api/test-sessions/clear",
  PRACTICE_SESSIONS: "/api/practice-sessions",
  PRACTICE_SESSION_HEARTBEAT: "/api/practice-sessions/heartbeat",
  getAmbientAudio: (trackId: string, version: string) =>
    `/api/ambient-audio/${encodeURIComponent(trackId)}?v=${encodeURIComponent(version)}`,
  // Public, session-free anonymous preview: the curated key-free question set for
  // the logged-out "quick practice" hook on the login screen. Persists nothing.
  ANONYMOUS_PRACTICE_QUESTIONS: "/api/anonymous-practice/questions",
  // Admin management of the curated anonymous set (edit_public_exams).
  ADMIN_ANONYMOUS_PRACTICE: "/api/admin/anonymous-practice",
  // Proof-of-human verification: client POSTs a Turnstile token, server sets the
  // signed human cookie the content routes require (lib/turnstile.ts).
  HUMAN_VERIFY: "/api/human/verify",
  // Signup risk gate: client POSTs its browser fingerprint, server returns it as a
  // signed httpOnly cookie the gate reads in /auth/callback (lib/riskGate/).
  // Public by necessity — it is called BEFORE anyone is signed in.
  RISK_FINGERPRINT: "/api/risk/fingerprint",
  // Result-derived practice suggestions (weak-skill drills) + the server-side
  // create for a suggested drill (source stays authoritative).
  PRACTICE_SUGGESTIONS: "/api/practice-sessions/suggestions",
  PRACTICE_SUGGESTED: "/api/practice-sessions/suggested",
  PRACTICE_SUGGESTION_DISMISS: "/api/practice-sessions/suggestions/dismiss",
  // Materialize a curated set Ask Rob PROPOSED (assemble_practice's deferred
  // create-on-click): the id list is re-validated against the public+published
  // bank here, capped, cap-gated at DOING time, and scrape-metered — nothing is
  // frozen until the student taps the button.
  PRACTICE_ASSEMBLE: "/api/practice-sessions/assemble",
  // The viewer's compilation LIBRARY — every saved set they own or were shared,
  // with the auto-created "Liked questions" set guaranteed and first. Distinct from
  // TEACHER_COLLECTIONS, which also returns every publicly published compilation
  // (a browse result, not the student's own shelf). Backs the Practice page's
  // right-hand rail.
  USER_COMPILATIONS: "/api/user/compilations",
  // Add questions to one or many compilations at once (`liked: true` targets the
  // Liked set without knowing its id). Backs the multi-select "Add to compilation"
  // dialog and the per-row like action.
  USER_COMPILATIONS_ADD_QUESTIONS: "/api/user/compilations/add-questions",
  // Remove questions from one or many compilations by QUESTION id — the write
  // behind the "Add to compilation" dialog's untick (sets the selection is already
  // in arrive pre-ticked; un-ticking one removes on Done).
  USER_COMPILATIONS_REMOVE_QUESTIONS: "/api/user/compilations/remove-questions",
  // The mirror of the above's `liked: true`: drop questions from the caller's own
  // Liked set, addressed by QUESTION id so a row in ANY compilation can unlike.
  USER_COMPILATIONS_UNLIKE_QUESTIONS: "/api/user/compilations/unlike-questions",
  // CREATOR PROFILES (the main app's public identity page, /profile/<username>) —
  // deliberately NOT the forum profile, which has its own routes under /api/forum.
  // One GET for the whole page payload, one POST/DELETE for the follow toggle.
  // `ronansat` resolves to the platform identity, which has no profiles row.
  CREATOR_PROFILES: "/api/profiles",
  // Ask Rob's personalised Learning Path cards (saved criteria configs Rob built
  // via create_learning_path_card). List/create (max 10 -> 409) + per-card
  // delete + one-click start (re-samples the bank).
  ASKROB_LEARNING_PATH_CARDS: "/api/askrob/learning-path-cards",
  TEST_PDF_DOWNLOAD: "/api/test-pdfs/download",
  TEST_PDF_INFO: "/api/test-pdfs/info",
  TESTS: "/api/tests",
  // Practice browse: superset cards (layer 0), one superset's screen, and one
  // collection's server-paginated tests.
  TESTS_SUPERSETS: "/api/tests/supersets",
  TESTS_COLLECTION_TESTS: "/api/tests/collection-tests",
  // Public dashboard ADVERTISEMENTS. An advert is a PROJECT (a campaign) holding one
  // to five lettered creatives; each creative is an admin-uploaded asset (image or
  // short MP4) served from R2 through the media route below. The list route returns
  // the ONE variant each viewer is assigned per delivered project, minus their
  // dismissals, plus the global carousel settings.
  ADVERTISEMENTS: "/api/advertisements",
  ADMIN_ADVERTISEMENTS: "/api/admin/advertisements",
  ADMIN_ADVERTISEMENT_SETTINGS: "/api/admin/advertisements/settings",
  // Read-only performance warehouse behind the panel's statistics readout
  // (impressions, clicks, dismissals, attributed purchases). Takes ?windowDays=.
  ADMIN_ADVERTISEMENT_STATS: "/api/admin/advertisements/stats",
  // TASK-BASED GIVEAWAY EVENTS. A campaign is a task ("invite 3 friends who sign up")
  // plus a reward ("unlock this test in Practice") plus the set of tests it covers.
  // Both kinds are registry keys, so the list route returns the available options
  // alongside the campaigns rather than the panel hardcoding them.
  ADMIN_GIVEAWAYS: "/api/admin/giveaways",
  adminGiveaway: (campaignId: string) => `/api/admin/giveaways/${encodeURIComponent(campaignId)}`,
  // The STUDENT's own run of one campaign on one test: derived progress, the roster, and
  // whether delivery has stamped the reward. Polled by the event page's progress panel,
  // because the thing it reports on (a friend registering) happens on another device with
  // nothing to notify this tab. Scoped to the session's user — the query names the
  // campaign and the test, never a participant.
  giveawayParticipation: (slug: string, testId: string) =>
    `/api/giveaways/participation?slug=${encodeURIComponent(slug)}&testId=${encodeURIComponent(testId)}`,
  // THE MANUAL ATTRIBUTION PATH. A signed-in student posts the 12-character invite code a
  // friend gave them; the server records the same pending claim the signup path would have
  // recorded and mints their own run of the event. Exists because both automatic carriers
  // (the signed cookie, the signed `gwi` URL parameter) are properties of a BROWSER, and
  // neither survives reading the link on a phone and signing up on a laptop.
  GIVEAWAY_CLAIM_CODE: "/api/giveaways/claim-code",
  // The participation roster for one campaign (GET) and the manual reward revoke
  // (POST). Progress is derived from the claim ledger at read time, never stored.
  adminGiveawayParticipations: (campaignId: string) =>
    `/api/admin/giveaways/${encodeURIComponent(campaignId)}/participations`,
  // The claim ledger for one campaign (GET, optional ?status=) and the manual verdict
  // override (POST) — the escape hatch for both a false positive and a farm that passed.
  //
  // `status` is optional and passed through verbatim, including the literal "all" the
  // route reads as "no filter". The panel's default view is the PENDING backlog, which
  // is the one number that says whether the sweep is still running, so the filter has
  // to be part of the URL rather than something the client narrows after fetching
  // everything.
  adminGiveawayReferrals: (campaignId: string, status?: string) =>
    `/api/admin/giveaways/${encodeURIComponent(campaignId)}/referrals${
      status ? `?status=${encodeURIComponent(status)}` : ""
    }`,
  ADMIN_TESTS: "/api/admin/tests",
  ADMIN_TESTS_BULK: "/api/admin/tests/bulk",
  ADMIN_TEST_COLLECTIONS: "/api/admin/test-collections",
  ADMIN_TEST_SUPERSETS: "/api/admin/test-supersets",
  ADMIN_TEST_PDFS: "/api/admin/test-pdfs",
  ADMIN_TEST_PDF_REBUILD: "/api/admin/test-pdfs/rebuild",
  ADMIN_TEST_PDF_DOWNLOAD: "/api/admin/test-pdfs/download",
  ADMIN_EMAIL: "/api/admin/email",
  ADMIN_USER_SEARCH: "/api/admin/users/search",
  ADMIN_WATERMARK_IDENTIFY: "/api/admin/watermark/identify",
  ADMIN_ADAPTIVE_TESTS: "/api/admin/adaptive-tests",
  ADMIN_IMPERSONATE: "/api/admin/impersonate",
  // Teacher Surveys hub (create_surveys) — signup forms + availability polls,
  // scoped to the actor's own (there is no admin superset; surveys are
  // teacher-only).
  TEACHER_FORMS: "/api/teacher/forms",
  TEACHER_FORMS_UPLOAD_IMAGE: "/api/teacher/forms/upload-image",
  // The caller's own previously uploaded form images (the media picker's library
  // tab), so an image can be reused across forms without re-uploading it.
  TEACHER_FORMS_MEDIA: "/api/teacher/forms/media",
  TEACHER_AVAILABILITY_POLLS: "/api/teacher/availability-polls",
  // Hub — question edit PROPOSALS. A holder of `propose_question_edit`
  // lists/creates only their OWN proposals; a holder of `edit_public_exams` sees
  // every proposal and owns the merge/reject actions. The same routes serve both
  // sides — the service scopes by capability (see questionEditProposalService).
  TEACHER_QUESTION_PROPOSALS: "/api/teacher/question-proposals",
  COURSES: "/api/courses",
  COURSES_MANAGED_GROUPS: "/api/courses/managed-groups",
  // Teacher Collections hub (manage_collection) — curated question sets, usable
  // by any session host the collection is shared with (view access), editable
  // only by holders of manage_collection with edit access to the collection.
  TEACHER_COLLECTIONS: "/api/teacher/collections",
  TEACHER_COLLECTIONS_MANAGED_GROUPS: "/api/teacher/collections/managed-groups",
  USER_GROUP_ACCESS_TOKEN: "/api/user/group-access-token",
  USER_HOMEWORK_COLLECTIONS: "/api/user/homework/collections",
  USER_HOMEWORK_COLLECTIONS_START: "/api/user/homework/collections/start",
  // The viewer's own system-generated compilations ("Yours Daily" / "Yours
  // Weekly"), newest period of each kind — the two read-only cards in the
  // Practice page's "For You" row. Generated by the cron sweep; see
  // lib/services/personalisedCompilationService.ts.
  USER_PERSONALISED_COMPILATIONS: "/api/user/personalised-compilations",
  // Admin management for those two kinds: settings + stats (GET), a partial
  // settings patch (PATCH), and an on-demand generator pass (the /run child).
  ADMIN_PERSONALISED_COMPILATIONS: "/api/admin/personalised-compilations",
  ADMIN_PERSONALISED_COMPILATIONS_RUN: "/api/admin/personalised-compilations/run",
  USER_WATERMARK: "/api/user/watermark",
  USER_DEVICES: "/api/user/devices",
  USER_DEVICES_REGISTER: "/api/user/devices/register",
  USER_DEVICES_TAKEOVER: "/api/user/devices/takeover",
  USER_DEVICES_CLAIM: "/api/user/devices/claim",
  SHOP: "/api/shop",
  SHOP_PURCHASE: "/api/shop/purchase",
  PET: "/api/pet",
  ADMIN_SHOP_ITEMS: "/api/admin/shop-items",
  // Advanced tier billing (VietQR + SePay). Create an order (returns the token +
  // prefilled QR image), read the caller's own subscription, and poll an order's
  // status while waiting for the transfer webhook. The SePay webhook + the cron
  // sweep are internal, not listed here (they are not called from the client).
  PAYMENT_ORDERS: "/api/payments/orders",
  // Buy a single PAID EXAM (kind='test' order on the same VietQR/SePay rails).
  // Body: { testId, code?, method? } — the price is always re-derived server-side.
  PAYMENT_TEST_ORDERS: "/api/payments/test-orders",
  // Buy a WHOLE COLLECTION as one bundle (kind='collection' order, same rails).
  // Body: { collectionId, method? } — the price is re-derived server-side.
  PAYMENT_COLLECTION_ORDERS: "/api/payments/collection-orders",
  // Buy ONE COURSE outright (kind='course' order, same rails). Body:
  // { courseId, code?, method? } — the price is always re-derived server-side.
  // Settlement grants a PERMANENT course_entitlements row.
  PAYMENT_COURSE_ORDERS: "/api/payments/course-orders",
  // Is this course for sale / already reached (bought or covered by the plan), and
  // what would a code make it cost (`?code=`)?
  getCoursePaywall: (courseId: string, code?: string) =>
    `/api/courses/${encodeURIComponent(courseId)}/paywall${
      code ? `?code=${encodeURIComponent(code)}` : ""
    }`,
  // Admin course PRICING — gated by `sell_courses` (NOT `create_courses`: authoring a
  // course and selling one are different grants). PUT sets a price, PATCH toggles
  // subscription inclusion, DELETE takes courses off sale. All bulk-shaped.
  ADMIN_COURSES_PAYWALL: "/api/admin/courses/paywall",
  // One row per course for Resource Management's Courses scope (read-only; the price
  // writes live on ADMIN_COURSES_PAYWALL). Readable with `edit_public_exams` OR
  // `sell_courses`, so a catalogue operator can see prices without being able to set
  // them.
  ADMIN_COURSES: "/api/admin/courses",
  // The Advanced PACKAGE catalogue. GET is public (the buy screens read prices from
  // the live `billing_plans` table rather than a compiled constant); PATCH is the
  // Resource Management > Packages editor and is gated by `manage_payments`.
  BILLING_PLANS: "/api/billing/plans",
  // Live price for ONE package with a discount code applied (authenticated — a code is not
  // a secret but it must not be enumerable). Same resolver order creation uses.
  billingQuote: (params: {
    planId: string;
    method: string;
    code?: string | null;
    allowAuto?: boolean;
  }) => {
    const query = new URLSearchParams({ planId: params.planId, method: params.method });
    if (params.code?.trim()) query.set("code", params.code.trim());
    // Only sent when suppressing, so the default URL (and its cache key) stays the simple one.
    if (params.allowAuto === false) query.set("auto", "0");
    return `/api/billing/quote?${query.toString()}`;
  },
  ADMIN_BILLING_PLANS: "/api/admin/billing/plans",
  // The operator-editable pricing knobs (default product prices + the international
  // conversion). GET needs `edit_public_exams` OR `manage_payments` because the
  // price-setting dialogs prefill from it; PATCH needs `manage_payments`.
  ADMIN_BILLING_SETTINGS: "/api/admin/billing/settings",
  // One-off ENTITLEMENTS admin across all three paid products (test / collection
  // bundle / course), gated by `manage_payments`. GET ?identifier= lists what a user
  // owns; POST gifts one; DELETE revokes one. A revoke never touches payment_orders.
  ADMIN_PAYMENT_ENTITLEMENTS: "/api/admin/payments/entitlements",
  adminPaymentEntitlements: (identifier: string) =>
    `/api/admin/payments/entitlements?identifier=${encodeURIComponent(identifier)}`,
  // Is this exam paid / already owned, plus a live discount quote (`?code=`).
  getTestPaywall: (testId: string, code?: string) =>
    `/api/tests/${encodeURIComponent(testId)}/paywall${
      code ? `?code=${encodeURIComponent(code)}` : ""
    }`,
  // Is this collection sold as a bundle / already owned, what does it cost, and what
  // would a code make it cost (`?code=`)?
  getCollectionPaywall: (collectionId: string, code?: string) =>
    `/api/tests/collections/${encodeURIComponent(collectionId)}/paywall${
      code ? `?code=${encodeURIComponent(code)}` : ""
    }`,
  // Admin "Security" action on tests (all gated by `edit_public_exams`, all
  // bulk-shaped: one row is a one-element testIds array).
  ADMIN_TESTS_PASSWORD: "/api/admin/tests/password",
  ADMIN_TESTS_PAYWALL: "/api/admin/tests/paywall",
  // The Advanced-plan exception on a test's gate (`tests.allow_advanced_bypass`). Its own
  // endpoint rather than a field on the password write, because an unlock campaign gates a
  // test that has no password at all and the flag has to be settable there too.
  ADMIN_TESTS_ADVANCED_BYPASS: "/api/admin/tests/advanced-bypass",
  // ACCESS CONTROL: the access mode (open / private / exclusive) and, for a private
  // test, its roster of named people. PUT sets the mode, POST shares with a
  // username/email, DELETE stops sharing, GET reads the roster for one test.
  ADMIN_TESTS_ACCESS: "/api/admin/tests/access",
  getAdminTestAccess: (testId: string) =>
    `/api/admin/tests/access?testId=${encodeURIComponent(testId)}`,
  ADMIN_TESTS_DISCOUNTS: "/api/admin/tests/discounts",
  // One code, from the Discounts master table (PATCH to edit / link, DELETE to remove).
  getAdminTestDiscount: (codeId: string) =>
    `/api/admin/tests/discounts/${encodeURIComponent(codeId)}`,
  // Bundle price for a whole collection (`edit_public_exams`, bulk-shaped:
  // PUT { collectionIds, priceVnd } / DELETE { collectionIds }).
  ADMIN_TEST_COLLECTIONS_PAYWALL: "/api/admin/test-collections/paywall",
  adminDeleteTestDiscount: (codeId: string) =>
    `/api/admin/tests/discounts?codeId=${encodeURIComponent(codeId)}`,
  USER_SUBSCRIPTION: "/api/user/subscription",
  getPaymentOrder: (token: string) => `/api/payments/orders/${encodeURIComponent(token)}`,
  // Owner-scoped "I'm leaving the QR screen" cancel — expires the caller's own
  // pending order immediately (fetch on back/close, sendBeacon on tab-exit).
  getPaymentOrderCancel: (token: string) =>
    `/api/payments/orders/${encodeURIComponent(token)}/cancel`,
  getAdminUserGrantAdvanced: (userId: string) => `/api/admin/users/${userId}/grant-advanced`,
  // Admin manual payment settle: look up an order by memo token, then mark it paid
  // (both gated by `manage_payments`).
  getAdminPaymentOrder: (token: string) =>
    `/api/admin/payments/orders/${encodeURIComponent(token)}`,
  adminMarkPaymentOrderPaid: (token: string) =>
    `/api/admin/payments/orders/${encodeURIComponent(token)}/mark-paid`,
  // Admin "Order Lookup" extras: permanently delete an order (irreversible,
  // bookkeeping cleanup only — never claws back a grant), and search orders by
  // buyer username / display name / id instead of the exact memo token.
  adminDeletePaymentOrder: (token: string) =>
    `/api/admin/payments/orders/${encodeURIComponent(token)}`,
  ADMIN_PAYMENT_ORDERS_SEARCH: "/api/admin/payments/orders/search",
  // Refunds. `adminRefundPaymentOrder` returns the buyer's money (via the Creem
  // API when the order was paid by card) and immediately revokes what the order granted;
  // `adminRefundedPaymentOrders` browses what has already been given back.
  adminRefundPaymentOrder: (token: string) =>
    `/api/admin/payments/orders/${encodeURIComponent(token)}/refund`,
  adminRefundedPaymentOrders: (limit: number) =>
    `/api/admin/payments/orders/refunded?limit=${limit}`,
  // Admin subscription management (all gated by `manage_payments`): aggregate
  // payment + subscription statistics, and a manual any-duration grant to a user
  // resolved by username / email / id.
  ADMIN_PAYMENT_STATS: "/api/admin/payments/stats",
  ADMIN_PAYMENT_GRANT: "/api/admin/payments/grant",
  // Admin purchases chart + recent-purchases list, custom range in days
  // (7 / 30 / 90 / 365) — the "Purchases" statistics section.
  adminPaymentPurchases: (rangeDays: number, page?: { offset?: number; limit?: number }) => {
    // `offset`/`limit` page the purchases LIST only — the chart and the totals in the same
    // response always cover the whole range.
    const params = new URLSearchParams({ range: String(rangeDays) });
    if (page?.offset) {
      params.set("offset", String(page.offset));
    }
    if (page?.limit) {
      params.set("limit", String(page.limit));
    }
    return `/api/admin/payments/purchases?${params.toString()}`;
  },
  // Admin AI credit management (gated by `manage_ask_rob_credit` — the permission
  // code still says ask_rob; the admin action is labelled "AI Credit").
  ADMIN_ASK_ROB_CREDIT_GIFT: "/api/admin/ask-rob-credit/gift",
  ADMIN_ASK_ROB_CREDIT_MULTIPLIERS: "/api/admin/ask-rob-credit/multipliers",
  adminAskRobCreditMultiplier: (id: string) =>
    `/api/admin/ask-rob-credit/multipliers/${encodeURIComponent(id)}`,
  // Admin AI usage resets — clear the Ask Rob energy windows and/or the rolling
  // IELTS Writing check allowance for a user / group / everyone. Gated by
  // `reset_ai_usage` (its own permission, NOT manage_ask_rob_credit). GET returns
  // the group picker's options.
  ADMIN_AI_USAGE_RESET: "/api/admin/ai-usage/reset",
  // Self-serve Ask Rob credit reset (spend one banked reset for a fresh window).
  ASK_ROB_CREDIT_RESET: "/api/ask-rob/credits/reset",
  // Dynamic routes

  getQuestionsByTestId: (
    testId: string,
    scope?: {
      mode?: string | null;
      section?: string | null;
      module?: number | null;
      preview?: boolean;
      /**
       * Ask for an UNOBFUSCATED payload because the obfuscated font would not load
       * (hooks/useObfuscatedFont gave up after five attempts). The server treats this as a
       * REQUEST, not an instruction: granted only for an open session, at most a few times a day,
       * and a refusal is silent — see memory/0.3/240 §7.4.
       */
      plain?: boolean;
      /**
       * The team-work lobby this run belongs to, when there is one. Mirrors the heartbeat
       * body's `lobbyId`: a lobby's SHARED clock legitimately force-advances a module, which
       * would otherwise read as a suspiciously fast module-1 exit. VERIFIED server-side
       * against lobby membership, so a forged id fails the check and the normal gate applies.
       */
      lobby?: string | null;
    }
  ) => {
    const params = new URLSearchParams({ testId });
    if (scope?.mode) {
      params.set("mode", scope.mode);
    }
    if (scope?.section) {
      params.set("section", scope.section);
    }
    if (scope?.module != null) {
      params.set("module", String(scope.module));
    }
    // Admin/editor preview: tells the server NOT to open an anti-scraping
    // session slot for this fetch (the read still returns the full keyed
    // payload because the caller is an editor).
    if (scope?.preview) {
      params.set("preview", "1");
    }
    if (scope?.plain) {
      params.set("render", "plain");
    }
    if (scope?.lobby) {
      params.set("lobby", scope.lobby);
    }
    return `/api/questions?${params.toString()}`;
  },
  getSheetLayoutByTestId: (testId: string) =>
    `/api/questions/sheet?testId=${encodeURIComponent(testId)}`,
  // Layer 2 of the practice browse: one collection's tests, server-paginated.
  // `collectionId` is a collection uuid or the literal "uncollected".
  getCollectionTests: (collectionId: string, page: number, limit: number) =>
    `/api/tests/collection-tests?collectionId=${encodeURIComponent(
      collectionId
    )}&page=${page}&limit=${limit}`,
  // `id` is the OPAQUE `user_devices.id` handle the device list returned, never a
  // browser id (see types/device.ts).
  deleteUserDevice: (id: string) => `/api/user/devices/${encodeURIComponent(id)}`,
  // Raw study-presence intervals for the dashboard study-activity rings. `start`
  // /`end` are the UTC bounds of the caller's local yesterday+today window
  // (computed client-side via lib/studyRing.ts studyRingRange).
  getUserStudyRings: (start: string, end: string) =>
    `/api/user/study-rings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  getAdminTest: (testId: string) => `/api/admin/tests/${testId}`,
  // Upload (POST raw bytes) / remove (DELETE) a test's card preview image.
  getAdminTestPreviewImage: (testId: string) => `/api/admin/tests/${testId}/preview-image`,
  getAdminTestCollection: (collectionId: string) => `/api/admin/test-collections/${collectionId}`,
  getAdminTestSuperset: (supersetId: string) => `/api/admin/test-supersets/${supersetId}`,
  getAdminTestSupersetThumbnail: (supersetId: string) =>
    `/api/admin/test-supersets/${supersetId}/thumbnail`,
  getTestSuperset: (slug: string) => `/api/tests/supersets/${encodeURIComponent(slug)}`,
  // One collection's meta (title, test count, parent superset) for its own screen.
  getTestCollectionMeta: (collectionId: string) =>
    `/api/tests/collections/${encodeURIComponent(collectionId)}`,
  // Public serving route for an uploaded superset illustration (R2 object key).
  getSupersetImage: (objectKey: string) =>
    `/api/supersets/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  // Public serving route for a test's card preview image (R2 object key).
  getTestPreviewImage: (objectKey: string) =>
    `/api/tests/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  getAdminTestExport: (testId: string) => `/api/admin/tests/${testId}/export`,
  getAdminTestAnswerKey: (testId: string, variant: string) =>
    `/api/admin/tests/${testId}/answer-key?variant=${encodeURIComponent(variant)}`,
  getAdminTestBulkUpdate: (testId: string) => `/api/admin/tests/${testId}/questions/bulk-update`,
  getAdminUserReport: (userId: string) => `/api/admin/users/${userId}/report`,
  getAdminUserBan: (userId: string) => `/api/admin/users/${userId}/ban`,
  getAdminUserPurge: (userId: string) => `/api/admin/users/${userId}/purge`,
  getAdminUserDeleteAccount: (userId: string) => `/api/admin/users/${userId}/delete-account`,
  getAdminUserStrikes: (userId: string) => `/api/admin/users/${userId}/strikes`,
  // Per-account headroom on the abuse ban ceilings (abuse_slot_allowances). Separate
  // from the strikes route because it is a different verb on a different ledger: the
  // strikes route reads/records VIOLATIONS, this one adjusts how many of them the
  // engine tolerates for one vetted account.
  getAdminUserSlots: (userId: string) => `/api/admin/users/${userId}/slots`,
  ADMIN_USERS_BANNED: "/api/admin/users/banned",
  ADMIN_USERS_WARNED: "/api/admin/users/warned",
  ADMIN_USERS_FLAGGED: "/api/admin/users/flagged",
  ADMIN_ABUSE_RULES: "/api/admin/abuse-rules",
  ADMIN_ABUSE_GUARD: "/api/admin/abuse-guard",
  ADMIN_ABUSE_GUARD_RUN: "/api/admin/abuse-guard/run",
  // Signup risk gate overview: mode, score distribution, decision counts and the
  // stored per-signal breakdown behind each ban (lib/services/risk/).
  ADMIN_RISK_GATE: "/api/admin/risk-gate",
  // The observation corpus behind that gate: `?view=stats` for coverage + cluster
  // shape, `?view=clusters&axis=fingerprint|device` for shared correlators, and
  // `?view=rows` for the paged log. Paged, so it is a separate route from the
  // unpaged overview above; takes no hash as input by design.
  ADMIN_RISK_GATE_OBSERVATIONS: "/api/admin/risk-gate/observations",
  // Per-account abuse/risk bypass grants: list (GET), grant (POST), revoke
  // (DELETE ?id=). Gated on `manage_abuse_bypass`, NOT on holding a bypass —
  // see lib/services/abuse/bypassGrantService.ts.
  ADMIN_ABUSE_BYPASS: "/api/admin/abuse-bypass",
  getAdminAbuseBypassRevoke: (grantId: string) =>
    `/api/admin/abuse-bypass?id=${encodeURIComponent(grantId)}`,
  // MASTER SECURITY LOG (read-only, admin-only): every event the security hub has
  // dispatched — bans, unbans, warnings, strikes, flags, bypass changes, risk-gate
  // mode flips. Filters: ?type= ?userId= ?actorUserId= ?q= ?from= ?to= ?limit=
  // ?offset=. Stored on Cloudflare D1, NOT Supabase, so append-only log volume
  // never bloats the system of record — see
  // lib/services/security/securityEventLogService.ts.
  ADMIN_SECURITY_LOG: "/api/admin/security-log",
  getAdminUserLeaderboard: (start: string, end: string) =>
    `/api/admin/users/leaderboard?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  getAdminUserDailyVolume: (userId: string, start: string, end: string) =>
    `/api/admin/users/${userId}/daily-volume?start=${encodeURIComponent(
      start
    )}&end=${encodeURIComponent(end)}`,
  // One advertisement project: read it with its variants (GET), replace its delivery
  // state (PUT), or delete it with every variant and their R2 artwork (DELETE).
  getAdminAdvertisement: (id: string) => `/api/admin/advertisements/${encodeURIComponent(id)}`,
  // Add a lettered creative to a project. The BODY is the raw artwork bytes (EMPTY for a
  // text placement, whose copy is `bodyText` below); the letter and the creative's own
  // fields ride the query string.
  createAdvertisementVariant: (
    projectId: string,
    params: {
      variant: string;
      altText: string;
      ctaHref: string;
      ctaLabel: string;
      /** Text placements only — the line a student reads. "" for a media creative. */
      bodyText?: string;
      /** Text placements only — an ADVERTISEMENT_BODY_ICONS name, or "" for the default. */
      bodyIcon?: string;
    }
  ) =>
    `/api/admin/advertisements/${encodeURIComponent(projectId)}/variants` +
    `?variant=${encodeURIComponent(params.variant)}` +
    `&altText=${encodeURIComponent(params.altText)}` +
    `&ctaHref=${encodeURIComponent(params.ctaHref)}` +
    `&ctaLabel=${encodeURIComponent(params.ctaLabel)}` +
    `&bodyText=${encodeURIComponent(params.bodyText ?? "")}` +
    `&bodyIcon=${encodeURIComponent(params.bodyIcon ?? "")}`,
  // One creative: edit its link/label/alt text (PUT) or delete it (DELETE). The artwork
  // itself is never replaced in place — see the route.
  getAdminAdvertisementVariant: (projectId: string, variantId: string) =>
    `/api/admin/advertisements/${encodeURIComponent(projectId)}/variants/${encodeURIComponent(
      variantId
    )}`,
  dismissAdvertisement: (id: string) => `/api/advertisements/${encodeURIComponent(id)}/dismiss`,
  // Report that an advert was seen / pressed / closed. Fire-and-forget from the
  // student surfaces; always answers 204 (see the route).
  recordAdvertisementEvent: (id: string) => `/api/advertisements/${encodeURIComponent(id)}/events`,
  // Clear EVERY user's dismissal so the advert re-appears for everyone who closed it.
  resetAdvertisementDismissals: (id: string) =>
    `/api/admin/advertisements/${encodeURIComponent(id)}/reset-dismissals`,
  // Statistics over a bounded window (7 | 30 | 90 | 365 days). Passing a project id
  // scopes the read to that campaign AND returns the per-day series the graphs draw.
  getAdvertisementStats: (windowDays: number, projectId?: string) =>
    `/api/admin/advertisements/stats?windowDays=${encodeURIComponent(String(windowDays))}` +
    (projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""),
  // Public cached read of one advertisement creative. The object key is already
  // slash-separated, so each segment is encoded individually.
  getAdvertisementMedia: (objectKey: string) =>
    `/api/advertisements/media/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  getAdminShopItem: (itemId: string) => `/api/admin/shop-items/${itemId}`,
  getAdminAdaptiveTest: (id: string) => `/api/admin/adaptive-tests/${id}`,
  getAdminAdaptiveTestGenerate: (id: string) => `/api/admin/adaptive-tests/${id}/generate-forms`,
  getAdminAdaptiveTestStatus: (id: string) => `/api/admin/adaptive-tests/${id}/status`,
  getAdminAdaptiveTestScoreTable: (id: string) => `/api/admin/adaptive-tests/${id}/score-table`,
  getAdminAdaptiveTestDeliver: (id: string) => `/api/admin/adaptive-tests/${id}/deliver`,
  getAdminAdaptiveTestStats: (id: string) => `/api/admin/adaptive-tests/${id}/stats`,
  getAdminAdaptiveTestPreviewQuestions: (id: string) =>
    `/api/admin/adaptive-tests/${id}/preview-questions`,
  getAdminAdaptiveTestDummyAttempts: (id: string) =>
    `/api/admin/adaptive-tests/${id}/dummy-attempts`,
  getAdminAdaptiveTestAutoCalibrate: (id: string) =>
    `/api/admin/adaptive-tests/${id}/auto-calibrate`,
  getAdminAdaptiveTestDeliveries: (id: string) => `/api/admin/adaptive-tests/${id}/deliveries`,
  getAdminAdaptiveTestAccess: (id: string) => `/api/admin/adaptive-tests/${id}/access`,
  // The student card's cover. Separate from the draft-only config PATCH: a cover is
  // presentation, so it stays editable on a published test.
  getAdminAdaptiveTestCover: (id: string) => `/api/admin/adaptive-tests/${id}/cover`,
  getAdminAdaptiveTestDeliveryCandidates: (id: string, query?: string) =>
    `/api/admin/adaptive-tests/${id}/deliveries/candidates${
      query ? `?q=${encodeURIComponent(query)}` : ""
    }`,
  ADAPTIVE_DELIVERED: "/api/adaptive-tests/delivered",
  ADAPTIVE_DELIVERED_RESULTS: "/api/adaptive-attempts/delivered-results",
  ADAPTIVE_PENDING_RESULTS: "/api/adaptive-attempts/pending-results",
  ADAPTIVE_DISQUALIFIED_RESULTS: "/api/adaptive-attempts/disqualified-results",
  ADAPTIVE_RESULTS_UNSEEN_COUNT: "/api/adaptive-attempts/unseen-count",
  ADAPTIVE_RESULTS_MARK_SEEN: "/api/adaptive-attempts/mark-seen",
  getAdaptiveTestProbe: (id: string) => `/api/adaptive-tests/${id}/probe`,
  getAdaptiveTestStart: (id: string) => `/api/adaptive-tests/${id}/start`,
  getAdaptiveAttemptStep: (attemptId: string) => `/api/adaptive-attempts/${attemptId}`,
  getAdaptiveAttemptSubmitModule: (attemptId: string) =>
    `/api/adaptive-attempts/${attemptId}/submit-module`,
  getAdaptiveAttemptResult: (attemptId: string) => `/api/adaptive-attempts/${attemptId}/result`,
  getAdaptiveAttemptReport: (attemptId: string) => `/api/adaptive-attempts/${attemptId}/report`,
  getAdaptiveAttemptBreakdown: (attemptId: string) =>
    `/api/adaptive-attempts/${attemptId}/breakdown`,
  getAdaptiveAttemptQuestion: (attemptId: string, questionId: string) =>
    `/api/adaptive-attempts/${attemptId}/questions/${questionId}`,
  getAdaptiveAttemptShare: (attemptId: string) => `/api/adaptive-attempts/${attemptId}/share`,
  getSharedReport: (token: string) => `/api/shared-reports/${token}`,
  getAdaptiveAttemptDisqualify: (attemptId: string) =>
    `/api/adaptive-attempts/${attemptId}/disqualify`,
  getAdaptiveAttemptResumeBreak: (attemptId: string) =>
    `/api/adaptive-attempts/${attemptId}/resume-break`,
  getAdminAdaptiveTestAttempts: (id: string) => `/api/admin/adaptive-tests/${id}/attempts`,
  getAdminAdaptiveAttempt: (id: string, attemptId: string) =>
    `/api/admin/adaptive-tests/${id}/attempts/${attemptId}`,
  getAdminAdaptiveAttemptReport: (id: string, attemptId: string) =>
    `/api/admin/adaptive-tests/${id}/attempts/${attemptId}/report`,
  getAdminAdaptiveAttemptShare: (id: string, attemptId: string) =>
    `/api/admin/adaptive-tests/${id}/attempts/${attemptId}/share`,
  // Teacher-owned forms + polls (manage_own_forms). Same shapes as the admin
  // routes, but the service scopes every read/write to the caller's own rows.
  getTeacherForm: (formId: string) => `/api/teacher/forms/${formId}`,
  // POST — copy a form into a new draft owned by the caller (no body).
  getTeacherFormDuplicate: (formId: string) => `/api/teacher/forms/${formId}/duplicate`,
  getTeacherFormSubmissions: (formId: string) => `/api/teacher/forms/${formId}/submissions`,
  getTeacherFormSubmission: (formId: string, submissionId: string) =>
    `/api/teacher/forms/${formId}/submissions/${submissionId}`,
  getTeacherAvailabilityPoll: (pollId: string) => `/api/teacher/availability-polls/${pollId}`,
  // POST — copy a poll into a new draft owned by the caller (no body).
  getTeacherAvailabilityPollDuplicate: (pollId: string) =>
    `/api/teacher/availability-polls/${pollId}/duplicate`,
  getTeacherAvailabilityPollResults: (pollId: string) =>
    `/api/teacher/availability-polls/${pollId}/results`,
  getTeacherAvailabilityPollVote: (pollId: string, voteId: string) =>
    `/api/teacher/availability-polls/${pollId}/votes/${voteId}`,
  // Hub — question edit proposals. `base` returns the editable question
  // payload the "Propose edit" dialog opens with (answer-key bearing, staff-only);
  // `resolve` is the reviewer-only merge/reject/reopen action.
  getTeacherQuestionProposal: (proposalId: string) =>
    `/api/teacher/question-proposals/${encodeURIComponent(proposalId)}`,
  getTeacherQuestionProposalComments: (proposalId: string) =>
    `/api/teacher/question-proposals/${encodeURIComponent(proposalId)}/comments`,
  getTeacherQuestionProposalResolve: (proposalId: string) =>
    `/api/teacher/question-proposals/${encodeURIComponent(proposalId)}/resolve`,
  getTeacherQuestionProposalEmailSubscription: (proposalId: string) =>
    `/api/teacher/question-proposals/${encodeURIComponent(proposalId)}/email-subscription`,
  getTeacherQuestionProposalBase: (questionId: string) =>
    `/api/teacher/question-proposals/base/${encodeURIComponent(questionId)}`,
  // Public read of a form-media R2 object (uploaded image). The key already
  // carries the forms/uploads/ prefix; segments are encoded for the URL.
  formMediaSrc: (objectKey: string) =>
    `/api/forms/images/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
  getPublicForm: (token: string) => `/api/forms/${encodeURIComponent(token)}`,
  submitPublicForm: (token: string) => `/api/forms/${encodeURIComponent(token)}/submit`,
  getPublicPoll: (token: string) => `/api/polls/${encodeURIComponent(token)}`,
  votePublicPoll: (token: string) => `/api/polls/${encodeURIComponent(token)}/vote`,
  getCourse: (courseId: string) => `/api/courses/${courseId}`,
  getCourseLessons: (courseId: string) => `/api/courses/${courseId}/lessons`,
  getCourseLesson: (courseId: string, lessonId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}`,
  getCourseLessonsReorder: (courseId: string) => `/api/courses/${courseId}/lessons/reorder`,
  getCourseLessonParts: (courseId: string, lessonId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}/parts`,
  getCourseLessonPart: (courseId: string, lessonId: string, partId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}/parts/${partId}`,
  getCourseLessonPartsReorder: (courseId: string, lessonId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}/parts/reorder`,
  getCourseLessonPartComplete: (courseId: string, lessonId: string, partId: string) =>
    `/api/courses/${courseId}/lessons/${lessonId}/parts/${partId}/complete`,
  // The practice mirror of the lesson-part completion route: for a practice part
  // with nothing to submit, the student marks it done the same way.
  getCoursePracticePartComplete: (courseId: string, practiceId: string, partId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/parts/${partId}/complete`,
  getCourseUnits: (courseId: string) => `/api/courses/${courseId}/units`,
  getCourseUnit: (courseId: string, unitId: string) => `/api/courses/${courseId}/units/${unitId}`,
  getCourseSections: (courseId: string) => `/api/courses/${courseId}/sections`,
  getCourseSection: (courseId: string, sectionId: string) =>
    `/api/courses/${courseId}/sections/${sectionId}`,
  getCourseTexts: (courseId: string) => `/api/courses/${courseId}/texts`,
  getCourseText: (courseId: string, textId: string) => `/api/courses/${courseId}/texts/${textId}`,
  getCourseOutline: (courseId: string) => `/api/courses/${courseId}/outline`,
  getCoursePublish: (courseId: string) => `/api/courses/${courseId}/publish`,
  getCourseDraft: (courseId: string) => `/api/courses/${courseId}/draft`,
  getCourseDraftPreviewEmbeds: (courseId: string) =>
    `/api/courses/${courseId}/draft-preview-embeds`,
  getCourseEditLock: (courseId: string) => `/api/courses/${courseId}/edit-lock`,
  getCourseHubTicket: (courseId: string) => `/api/courses/${courseId}/hub-ticket`,
  getCourseMembers: (courseId: string) => `/api/courses/${courseId}/members`,
  getCourseMember: (courseId: string, userId: string) =>
    `/api/courses/${courseId}/members/${userId}`,
  getCourseGroupGrants: (courseId: string) => `/api/courses/${courseId}/group-grants`,
  getCourseGroupGrant: (courseId: string, groupId: string) =>
    `/api/courses/${courseId}/group-grants/${groupId}`,
  getCourseCheckAnswer: (courseId: string) => `/api/courses/${courseId}/check-answer`,
  getCoursePermissions: (courseId: string) => `/api/courses/${courseId}/permissions`,
  getCoursePractices: (courseId: string) => `/api/courses/${courseId}/practices`,
  getCoursePractice: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}`,
  getCollection: (collectionId: string) => `/api/teacher/collections/${collectionId}`,
  // CREATOR PROFILE reads/writes, keyed by username (the platform's own handle
  // `ronansat` included — it resolves server-side to the virtual identity).
  getCreatorProfile: (username: string) => `/api/profiles/${encodeURIComponent(username)}`,
  getCreatorProfileFollow: (username: string) =>
    `/api/profiles/${encodeURIComponent(username)}/follow`,
  getCollectionQuestions: (collectionId: string) =>
    `/api/teacher/collections/${collectionId}/questions`,
  // Add questions sourced from the caller's OWN error log — the add path open
  // to every signed-in user (the plain questions POST above additionally needs
  // `manage_collection` to browse the bank).
  getCollectionQuestionsFromErrorLog: (collectionId: string) =>
    `/api/teacher/collections/${collectionId}/questions/from-error-log`,
  getCollectionQuestion: (collectionId: string, entryId: string) =>
    `/api/teacher/collections/${collectionId}/questions/${entryId}`,
  getCollectionSearch: (collectionId: string) => `/api/teacher/collections/${collectionId}/search`,
  getCollectionMembers: (collectionId: string) =>
    `/api/teacher/collections/${collectionId}/members`,
  getCollectionMember: (collectionId: string, userId: string) =>
    `/api/teacher/collections/${collectionId}/members/${userId}`,
  getCollectionGroupGrants: (collectionId: string) =>
    `/api/teacher/collections/${collectionId}/group-grants`,
  getCollectionGroupGrant: (collectionId: string, groupId: string) =>
    `/api/teacher/collections/${collectionId}/group-grants/${groupId}`,
  getCoursePracticeRun: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/run`,
  getCoursePracticeSubmit: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/submit`,
  getCoursePracticeSelectTest: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/select-test`,
  getCoursePracticeTestChoice: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/test-choice`,
  getCoursePracticeReview: (courseId: string, practiceId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/review`,
  getStudentPracticeResult: (courseId: string, practiceId: string, studentId: string) =>
    `/api/courses/${courseId}/practices/${practiceId}/students/${studentId}/result`,
  getStudentPracticeResultQuestion: (
    courseId: string,
    practiceId: string,
    studentId: string,
    attemptId: string,
    questionId: string
  ) =>
    `/api/courses/${courseId}/practices/${practiceId}/students/${studentId}/result/${attemptId}/questions/${questionId}`,
  getCourseAttachableTests: (courseId: string) => `/api/courses/${courseId}/attachable-tests`,
  getCourseCopyQuestion: (courseId: string) => `/api/courses/${courseId}/copy-question`,
  getCourseGradebook: (courseId: string) => `/api/courses/${courseId}/gradebook`,
  getCourseHomework: (courseId: string) => `/api/courses/${courseId}/homework`,
  getGroup: (groupId: string) => `/api/groups/${groupId}`,
  getGroupLeave: (groupId: string) => `/api/groups/${groupId}/leave`,
  getGroupMembers: (groupId: string) => `/api/groups/${groupId}/members`,
  getGroupMember: (groupId: string, userId: string) => `/api/groups/${groupId}/members/${userId}`,
  getGroupManagers: (groupId: string) => `/api/groups/${groupId}/managers`,
  getGroupManager: (groupId: string, userId: string) => `/api/groups/${groupId}/managers/${userId}`,
  getGroupReport: (groupId: string) => `/api/groups/${groupId}/report`,
  getGroupReportRoster: (groupId: string, since?: string | null) =>
    `/api/groups/${groupId}/report-roster${since ? `?${new URLSearchParams({ since })}` : ""}`,
  getGroupMemberReport: (groupId: string, userId: string) =>
    `/api/groups/${groupId}/members/${userId}/report`,
  getGroupMemberAttemptResult: (groupId: string, userId: string, attemptId: string) =>
    `/api/groups/${groupId}/members/${userId}/report/attempts/${attemptId}`,
  getGroupMemberAssignments: (groupId: string, userId: string) =>
    `/api/groups/${groupId}/members/${userId}/assignments`,
  getGroupMemberReportProfile: (groupId: string, userId: string) =>
    `/api/groups/${groupId}/members/${userId}/report-profile`,
  getGroupMemberReportData: (
    groupId: string,
    userId: string,
    start?: string,
    end?: string,
    name?: string
  ) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (name && name.trim()) params.set("name", name.trim());
    const qs = params.toString();
    return `/api/groups/${groupId}/members/${userId}/report-data${qs ? `?${qs}` : ""}`;
  },
  getGroupMemberReportSend: (groupId: string, userId: string) =>
    `/api/groups/${groupId}/members/${userId}/report/send`,
  getGroupReportSchedule: (groupId: string) => `/api/groups/${groupId}/report-schedule`,
  getGroupAssignments: (
    groupId: string,
    params?: { cursor?: string | null; assignmentId?: string | null }
  ) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.assignmentId) query.set("assignmentId", params.assignmentId);
    const qs = query.toString();
    return `/api/groups/${groupId}/assignments${qs ? `?${qs}` : ""}`;
  },
  getGroupAssignment: (groupId: string, assignmentId: string) =>
    `/api/groups/${groupId}/assignments/${assignmentId}`,
  getGroupAssignableTests: (groupId: string, query?: string) =>
    `/api/groups/${groupId}/assignments/tests${query ? `?q=${encodeURIComponent(query)}` : ""}`,
  getGroupAssignableCourses: (groupId: string, query?: string) =>
    `/api/groups/${groupId}/assignments/courses${query ? `?q=${encodeURIComponent(query)}` : ""}`,
  getGroupAssignableCollections: (groupId: string) =>
    `/api/groups/${groupId}/assignments/collections`,
  getGroupMilestones: (groupId: string) => `/api/groups/${groupId}/milestones`,
  getGroupMilestoneTests: (groupId: string, query?: string) =>
    `/api/groups/${groupId}/milestones/tests${query ? `?q=${encodeURIComponent(query)}` : ""}`,
  getGroupInviteToken: (groupId: string) => `/api/groups/${groupId}/invite-token`,
  getGroupEmail: (groupId: string) => `/api/groups/${groupId}/email`,
  getGroupSession: (sessionId: string) => `/api/groups/sessions/${sessionId}`,
  getGroupSessionSummary: (sessionId: string) => `/api/groups/sessions/${sessionId}/summary`,
  getGroupSessionWsTicket: (sessionId: string) => `/api/groups/sessions/${sessionId}/ws-ticket`,
  getGroupSessionEnd: (sessionId: string) => `/api/groups/sessions/${sessionId}/end`,
  getGroupSessionQuiz: (sessionId: string) => `/api/groups/sessions/${sessionId}/quiz`,
  getGroupSessionQuizSearch: (sessionId: string) => `/api/groups/sessions/${sessionId}/quiz/search`,
  getGroupSessionQuizExtend: (sessionId: string) => `/api/groups/sessions/${sessionId}/quiz/extend`,
  getGroupSessionQuizEnd: (sessionId: string) => `/api/groups/sessions/${sessionId}/quiz/end`,
  getGroupSessionHistory: (groupId: string) => `/api/groups/${groupId}/sessions`,
  getTeamWorkLobby: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}`,
  getTeamWorkLobbyStart: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}/start`,
  getTeamWorkLobbyEnd: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}/end`,
  getTeamWorkLobbyJoin: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}/join`,
  getTeamWorkLobbyProgress: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}/progress`,
  getTeamWorkLobbyWsTicket: (lobbyId: string) => `/api/team-work/lobbies/${lobbyId}/ws-ticket`,
  getGroupTeamWork: (groupId: string) => `/api/groups/${groupId}/team-work`,
  getQuestionExplanation: (questionId: string) => `/api/questions/${questionId}/explanation`,
  getReviewResult: (resultId: string) => `/api/results/${resultId}`,
  getReviewQuestion: (resultId: string, questionId: string) =>
    `/api/results/${resultId}/questions/${questionId}`,
  RESULTS_QUESTIONS_BULK: "/api/results/questions/bulk",
  getTestManagerQuestion: (cardId: string) => `/api/test-manager/questions/${cardId}`,
  getTestManagerReport: (questionId: string) => `/api/test-manager-reports/${questionId}`,
  getPracticeSessionQuestions: (sessionId: string) =>
    `/api/practice-sessions/${sessionId}/questions`,
  // Start a run from any compilation in the caller's library — every kind runs its
  // STORED question list (a dynamic set is compiled, not re-sampled on start).
  // Replaced the retired per-pin start route.
  startUserCompilation: (collectionId: string) =>
    `/api/user/compilations/${encodeURIComponent(collectionId)}/start`,
  // Render the compilation as a PDF through the pdf-generator Worker (teacher +
  // admin today). POST `{ variant }`, answers with the PDF bytes.
  userCompilationPdf: (collectionId: string) =>
    `/api/user/compilations/${encodeURIComponent(collectionId)}/pdf`,
  // "Generate new" — re-sample a dynamic set's stored list from its own filter.
  // Owner-only, and the only thing that changes a dynamic set's contents.
  regenerateUserCompilation: (collectionId: string) =>
    `/api/user/compilations/${encodeURIComponent(collectionId)}/regenerate`,
  // BOOKMARK a compilation into the caller's library (POST) or drop the bookmark (DELETE).
  // The server picks the mode: a SYSTEM set is COPIED (it gets pruned, so keeping it means
  // owning a copy), anything else somebody else owns is LINKED (a reference, so the library
  // opens the original). Idempotent, and a link grants no access of its own.
  userCompilationLibraryEntry: (collectionId: string) =>
    `/api/user/compilations/${encodeURIComponent(collectionId)}/library`,
  getAskRobLearningPathCard: (cardId: string) =>
    `/api/askrob/learning-path-cards/${encodeURIComponent(cardId)}`,
  startAskRobLearningPathCard: (cardId: string) =>
    `/api/askrob/learning-path-cards/${encodeURIComponent(cardId)}/start`,
  getAnonymousPracticeQuestions: (section: string) =>
    `/api/anonymous-practice/questions?section=${encodeURIComponent(section)}`,
  getAdminAnonymousPracticeEntry: (entryId: string) => `/api/admin/anonymous-practice/${entryId}`,
};
