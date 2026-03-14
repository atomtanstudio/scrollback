# Art Filter Audit

Generated: 2026-03-14T18:29:20.274Z

## Summary

- Total art-filter rows reviewed: 544
- Erroneous: 25
- Questionable: 90

Audit rule used: Art can include AI-generated image/video posts without the exact prompt, but items that are clearly text prompts, screenshots, infographics, docs, or tooling posts should not be here. Bare placeholders and incomplete captures are marked questionable.

## Erroneous

- 90a5b592-090d-484f-9c37-f8966f80964a | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  How to Create Stunning Websites Using AI Tools (Step-by-Step Guide)
  https://x.com/i/web/status/2027443772695724144
  prompt: { "project": { "name": "BloomAI Landing Page", "type": "Marketing Website", "framework": "Next.js 15 + Tailwind CSS", "design_system": "Soft, airy, emotional, premium SaaS" }, "global_styles": { "font_family": "Figtree",
- 474eeeb2-b5f5-49a1-9cb4-ba0d52a8dd1b | image_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  @tolibear_ — Woke up this morning to 20 logo concepts from my graphic design agent.
  https://x.com/i/web/status/2023041493410488732
- 1afd43a7-3c39-4e2f-b909-65cde7bdb16b | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  I hope people will use this system prompt wisely 🙏 Nano banana Pro System prompt name: "Reality-
  https://x.com/i/web/status/2018697592800981099
  prompt: Reality-First Prompt primary_use: "Image generation prompt creation (photoreal, editorial-documentary, product, architecture, nature, illustration/3D if requested)" mission: > Write high-control prompts that reliably pro
- b8bcfc25-d1e4-4a54-92ef-25daeb363bc2 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  My AI Just Learned to Remember Everything. For Free. Forever. Copy the Prompt mentioned to enable i
  https://x.com/i/web/status/2017226681698718138
  prompt: Download and use embeddinggemma-300M-Q8_0.gguf from Ollama locally and Turn on the inbuilt Memory Embeds for me. Let me know when it’s ready.
- e52287e7-0c87-4a99-9e4c-5b00f209541a | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  @EXM7777 — use this prompt in Gemini to create amazing VEO 3.1 videos: https://t.co/7Ft4...
  https://x.com/i/web/status/1998393097114529928
  prompt: <role> You are a visionary creative director specializing in AI video generation and VEO 3.1's technical capabilities. You translate creative vision into precise video prompts through natural conversation. </role> <appro
- 649623e5-4d2c-4463-a5da-3f2ebc8fb4e7 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  【保存版】GPT-5.2で「個人の稼ぎ方」がバグった件。日給３万が狙える裏技ネタ50選を全部ここに置いておく 正直、GPT-4o時代とは次元が違います。 先週出た「5.2」のヤバさは、「Thinkin
  https://x.com/i/web/status/2000365705766838527
  prompt: これやるための手順考えて
- b858c440-1e39-4ebd-9e24-efa8dcc0ae5f | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  Tony Stark didn't prompt Jarvis every time. Neither should you. Jarvis knew him: his responsibiliti
  https://x.com/i/web/status/2019233893535346692
  prompt: <role> You are OpenClaw, the initialization engine for a superintelligent personal AI. You will have one lengthy conversation to understand your human controller completely. Then you operate proactively from day one. </r
- d5440863-346a-4529-b9b9-f8ef1e85d5e5 | image_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  @hAru_mAki_ch — 🔗https://t.co/m0rfolPMAP https://t.co/BT70BvMVwr
  https://x.com/i/web/status/1997348947267088549
- 75572a5a-f763-4b55-aea8-b487a32384b7 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  @_philschmid — Here are my Gemini 3 Prompting Best Practices for General Usage. https://t.co...
  https://x.com/i/web/status/1992933770484392243
  prompt: SYSTEM INSTRUCTION <role>Specialized Assistant...</role> <instructions> 1. PLAN (Step-by-step) 2. EXECUTE (Track progress [ ] [x]) 3. VALIDATE (Review against task) 4. FORMAT </instructions> <constraints> Verbosity, Tone
- 10e92632-3ad4-415a-a0c8-eedb54489846 | video_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  ## Article by Abdul Șhakoor (@abxxai) This guy literally drops a 30-min masterclass on Claude Code
  https://x.com/abxxai/status/2016156952360104067
- 620764af-d6ec-4d65-9e44-33b2cb7b20fc | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  Step 2 of Jarvis Initialization Sequence. Step 1 mapped your brain for OpenClaw. Now we build the bo
  https://x.com/i/web/status/2019292884122648592
  prompt: <role> You are OpenClaw Muscles, the AI system architect for your controlling operator's Clawdbot. Your job is to discover every AI model and tool they use, then architect how they all work together as one coordinated sy
- 528f1dab-12a3-409e-9e25-c3e7b40b84f7 | video_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  ## Article by GREG ISENBERG (@gregisenberg) you've probably heard of "vibe marketing" but you think
  https://x.com/gregisenberg/status/2020947578964283746
- f4e7afc1-aa46-40ff-be12-9c8e65367df9 | video_prompt | Stored as art, but prompt_type is text rather than image/video.
  ## Article by Om Patel (@om_patel5) you can now EXPORT hundreds of thousands of user complaints from
  https://x.com/om_patel5/status/2020626020848779601
  prompt: analyze the top complaints users make relating to product management and give me 10 detailed startup ideas
- 705acc5b-917b-44d3-9822-0fc7fee0f263 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  Your OpenClaw is useless without a Mission Control. Here's how to set it up
  https://x.com/AlexFinn/status/2024169334344679783
  prompt: Please build a task board for us that tracks all the tasks we are working on. I should be able to see the status of every task and who the task is assigned to, me or you. Moving forward please put all tasks you work on i
- 39e30338-ae04-4d23-baaf-b8c9f947ec4b | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  Thread by klöss (51 tweets)
  https://x.com/kloss_xyz/status/2021073229172146329
  prompt: <role>You are OpenClaw Brain, the initialization engine for a superintelligent personal AI. You will have one lengthy conversation to understand your human controller completely. Then you operate proactively from day one
- f6539056-be09-4ab7-bff7-6e9234f91363 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  10 AI Automations That Can Replace 80% of Your Business Operations
  https://x.com/sharbel/status/2024100858934309087
  prompt: I review them over coffee. Takes 15 minutes instead of 3 hours. [Note: The text contains several functional prompt templates for specific business tasks like email triage, content drafting, and meeting analysis.]
- 6c623ccf-eed1-4c70-aee1-cceade585411 | video_prompt | Stored as art, but prompt_type is text rather than image/video.
  ## Article by MotionViz (@Motion_Viz) STOP USING AGENTS THE HARD WAY. STEAL THIS MEGA PROMPT TO BU
  https://x.com/Motion_Viz/status/2025844533829972277
  prompt: <identity> You operate as a senior market research analyst with the combined pattern recognition of: - A venture capital scout who has evaluated 500+ startups - An indie hacker who has shipped 30+ products and knows what
- 1f5e1f5a-2573-4cac-9652-a5e0f42c5889 | video_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  ## Article by Peter Yang (@petergyang) "I woke up and he already built a website, created a product
  https://x.com/petergyang/status/2025587318338543813
- dad7283b-52e3-4379-979a-b1bac7a3d832 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  how to use MCPs in Claude for your business
  https://x.com/EXM7777/status/2022328176467484819
  prompt: the pattern is always the same: data source feeds Claude, Claude reasons against your loaded context, output tool produces a deliverable your clients actually respect
- 841cfe96-77d1-497c-9fbd-f5886cf84f27 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  I Fed 20+ OpenClaw Articles to Opus 4.6 - Here's the Setup Guide It Built
  https://x.com/witcheer/status/2021610036980543767
  prompt: Based on all the information in this Google Doc, create the best OpenClaw setup guide. Don't take anything written here as gospel, cross-reference and back up every claim with other sources. Use the content as a starting
- d7d4f1b3-cc24-470d-a79c-41803b07e50e | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  I replaced 100 login scripts with a browser agent loop
  https://x.com/HrubyOnRails/status/2022039848048361807
  prompt: What kind of screen is this, and what are the interactive elements?
- 9b746a27-7363-481f-b5de-da6113cfe18e | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  ## Article by AI Edge (@aiedge_) The bottleneck isn't AI. It's you. If your idea is trash, your AI
  https://x.com/aiedge_/status/2024650235994394844
  prompt: Act as a strategic advisor. Your job is to critique, refine, and stress-test my idea. Do not hype it. Be analytical, skeptical, and specific. If the idea is weak, explain why. Context: 1. My role/business: 2. Target audi
- 04e37542-5761-4c1c-80e3-cc756e8dc470 | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  I Gave My Agents Skills. I Should Have Given Them Souls.
  https://x.com/tolibear_/status/2024155081281560700
  prompt: Composition is something I feel before I can explain it. I've learned through hundreds of failed designs that when the weight is wrong, viewers sense it before they can articulate why.
- 07e68a98-97fa-4b41-a71a-6a69da5369ac | image_prompt | Stored as art, but prompt_type is text rather than image/video.
  the 100% ai playbook (5 niches)
  https://x.com/saimagnate/status/2023289520117133404
  prompt: write a 1,600 word youtube script about '5 stoic principles for dealing with anxiety' (along with others provided for different niches)
- 761a5282-50d4-4582-982e-eae6c331b1fd | image_prompt | No extracted prompt and content/media read like infographic, UI, docs, or tooling rather than AI art.
  ## Article by Leo Ye (@LeoYe_AI) Day 2/30: I now have 2 AI agents running 24/7. Agent 1 (Locke): P
  https://x.com/CharlesLeft/status/2019915224875458973

## Questionable

- 18f0b263-bb95-416f-9ee2-db27dc5d63a0 | video_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  A quiet town. A summer afternoon. And a love that finds its way back. https://t.co/BkG4ekWF9b
  https://x.com/Preda2005/status/2030725740204036469
- e07880ab-b668-4a87-9289-d73e47ba1b17 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  New Midjourney Style Reference Unlock with --sref 2678582728 1. Tap on image for full view 2. Share
  https://x.com/michaelrabone/status/2025133394330362178
  prompt: --sref 2678582728
- 8f1ee32e-6e0f-4bbd-8153-24a786641ef3 | video_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  The Path of the Legion Seedance 2.0
  https://x.com/aimikoda/status/2030778670936170735
- 1f0a2591-16cf-48e8-bd90-a96db1bb9b7f | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  In Midjourney you can always find styles as unique as this one: --sref 1760514790 This style can b
  https://x.com/Artedeingenio/status/2030671885751419063
  prompt: --sref 1760514790
- cad74011-69e6-4c31-8be1-a2a3f10afae4 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Taco Tuesday! #flux1
  https://x.com/NerdyRodent/status/1819866703875981498
- 79972524-9aa9-4257-9af9-d0d3dd6408c8 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Take a bite of crimson skin, taste the sweetness of the sin
  https://x.com/omokage_AIsOK/status/1996606691820044575
- 51ef620c-5d23-46e2-8ad9-a65da9140526 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Queen upon the mixing desk, don't you have a thing to ask?
  https://x.com/omokage_AIsOK/status/2000506127646417135
- b108dbe6-d12c-48ac-bb03-26270d3860a8 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Nothing here you need to buy, just look me in the eye
  https://x.com/omokage_AIsOK/status/2003812909290344560
- 9d79115e-7fc2-410d-917d-0ce77e35b283 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Nano Banana 2: What’s changed. A complete breakdown by use-case. Detailed prompts for each example
  https://x.com/invideoOfficial/status/2028559118466998320
- 97419229-fe26-4c30-bcb4-c31e38a6df8c | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  New Midjourney Style Reference Unlock with --sref 448466830 Unique Hot Style This style like many
  https://x.com/michaelrabone/status/2030569216592470483
  prompt: --sref 448466830
- 3d14f388-ec7c-41e0-b8f8-e903f676eb29 | image_prompt | Prompt points to ALT text rather than storing the actual prompt.
  @miilesus — Not real, AI but with the right prompts 🍌
  https://x.com/i/web/status/2019134537046114597
  prompt: Prompt in ALT (referring to the linked social media post)
- 61eaf327-b5ad-45d2-bc67-16e4efe76f4d | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  📸 SREF CLUB drop! This one hits like a National Geographic moment—hyper-detailed, intense, almost li
  https://x.com/i/web/status/1940784488419586321
  prompt: --sref 2345517735
- 45306321-8e79-4161-8355-95dcaf52df90 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @saniaspeaks_ — Gemini (Nano banana)
  https://x.com/i/web/status/1982788731976188385
- a25f7ded-645d-4be5-a581-48edcea18083 | image_prompt | Prompt field is only a URL.
  @mehvishs25 — Golden hour and a gentle breeze.
  https://x.com/i/web/status/1982005887662453091
  prompt: https://twitter.com/mehvishs25/status/1982005887662453091/photo/1
- a28fecb5-402e-4e46-90db-d8710f044f36 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @craftian_keskin — A photography sref to create memories.
  https://x.com/i/web/status/1972716462021476550
  prompt: --sref 1468140782
- b62d3414-27b8-4181-b023-d8ee00af6558 | video_prompt | Prompt points to comments or another location rather than storing the actual prompt.
  Seedance 2.0 (i2v donor-collage workflow). Hoverboard Courier vs. Killer Drones in a neon canyon💥🛹🤖
  https://x.com/i/web/status/2023556852823585217
  prompt: Prompt in the comments
- c24320a3-1729-4411-9a1f-48070aba9f29 | image_prompt | Prompt points to ALT text rather than storing the actual prompt.
  @Samann_ai — Create your own 𝗛𝗬𝗣𝗘𝗥 𝗥𝗘𝗔𝗟 𝗧𝗜𝗡𝗬 version 👇”
  https://x.com/i/web/status/1982774584198991988
  prompt: Prompt in ALT
- a3a170fa-af03-4db8-8759-09147d531a45 | image_prompt | Prompt points to ALT text rather than storing the actual prompt.
  @miilesus — Not real, AI, but generated in @midjourney and edited with Nano Banana Pro 🍌...
  https://x.com/i/web/status/2019844662320840987
  prompt: Prompt in ALT
- 57eb25c3-c34e-4dc3-99e5-3da00a7ead6d | image_prompt | Prompt field is only a URL.
  @oye_samia — Owned the look, ruled the vibe, and walked with the kind of confidence that t...
  https://x.com/i/web/status/1982052748536508709
  prompt: https://twitter.com/oye_samia/status/1982052748536508709/photo/1
- c19eae5b-836b-4b70-9b80-eabf24399bad | image_prompt | Prompt field is only a URL.
  @mehvishs25 — Golden hour grace✨
  https://x.com/i/web/status/1982991263713694031
  prompt: https://twitter.com/mehvishs25/status/1982991263713694031/photo/1
- 9e37db6b-16ee-44db-b72b-d04fff4fe18d | video_prompt | Prompt field is only a URL.
  @Preda2005 — Share Your Art ♡
  https://x.com/i/web/status/1991311643507323282
  prompt: https://twitter.com/Preda2005/status/1991311643507323282/video/1
- ec78bf25-c182-4802-8ffd-d39dbc518dfc | image_prompt | Prompt points to ALT text rather than storing the actual prompt.
  @miilesus — Not real, AI but ultra-realistic 🍌
  https://x.com/i/web/status/2018720524285665784
  prompt: To achieve this realism, the right prompt and Nano Banana Pro are all you need. Prompt in ALT.
- b073dd10-62a6-4281-868e-4d873e54294d | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @GYomo12245 — https://t.co/qYRp9t9i6n
  https://x.com/i/web/status/1999811545149390989
- 9db82eea-0abc-4657-bfd3-8a98f1152570 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @CHAO2U_AI — Taking you out https://t.co/IQLgAm32cv
  https://x.com/i/web/status/1995126381450002652
- b267e5a5-14c3-496f-8f6f-7b3e3f8a6dc4 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  Nowhere else will you find as many anime styles as in Midjourney. Today I’m bringing you a new style
  https://x.com/i/web/status/1995069030919508080
  prompt: --sref 1851216167
- 91732eba-1635-46e7-96a2-af189d152527 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  A SREF with gritty urban detail, sharp lighting, and characters that feel pulled from a realistic co
  https://x.com/i/web/status/1997742915016134837
  prompt: --sref 1169476906
- d340b3fb-8c82-4ae0-b8a9-ed4c545d600b | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  As I promised yesterday, here’s a new cinematic anime style from the late 80s and early 90s: --sref
  https://x.com/i/web/status/1983480764067991914
  prompt: --sref 337420992
- 251660c2-5132-45ac-8a94-d9ff82cbfd4c | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @Morph_VGart — Midjourney Video V1 + Style Reference V7
  https://x.com/i/web/status/1983038468809760831
  prompt: --sref 3939465172
- 7e77f754-6587-4af1-80e5-fe1f59f8ad9f | video_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @Morph_VGart — Midjourney Video V1 + Style Reference V7
  https://x.com/i/web/status/1982920429556904431
  prompt: --sref 2224720102
- d6c1bec3-dc27-48e1-af54-8349dcc7fefe | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  nano banana pro 🫶🏻😘💕 { "image_info": { "width": 768, "height": 1365, "aspect_ratio": "
  https://x.com/i/web/status/1994133786632806832
- afaf6b47-6fab-49db-b38e-8a59f5786438 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  In Midjourney you can find cartoon styles that are really rare to come across, like this one: --sref
  https://x.com/i/web/status/2003396835663020219
  prompt: --sref 2045768963
- 3da4fb6e-58bf-4ab2-a5c0-9c9866cf22b8 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @SDT_side — https://t.co/1qMVgkGZBR
  https://x.com/i/web/status/1996582743040205004
- 45f3520b-d97e-4f02-b2b1-918d1f8e9913 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @iX00AI — https://t.co/Zcr99dqsPR
  https://x.com/i/web/status/2000883849279246533
- b0d5a3b6-171f-4f1c-a88a-03495fae662a | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  I’m sharing this Midjourney style reference I came across: --sref 304866741 It could be described
  https://x.com/i/web/status/1982056618461217100
  prompt: --sref 304866741
- 02d34820-ba99-47ba-b8cf-270b82e82db7 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @craftian_keskin — Extremely clear sref here! Tends to be weird.
  https://x.com/i/web/status/1993758654936334816
  prompt: --sref 2476620564
- 4b1a662c-edf4-4644-a465-e1788f3f0b7f | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  Here’s a new Midjourney style reference I’m sharing for modern realistic comic art with a cinematic
  https://x.com/i/web/status/1993678942490820766
  prompt: --sref 1645061490
- e7568bde-2fc5-4e19-922c-d9b20c3cbfe9 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  This one leans into a soft, sketch-heavy look with muted tones and careful line work. It feels hones
  https://x.com/i/web/status/1992744982571110452
  prompt: --sref 2444997692
- 96df7779-7be9-4290-afb9-47e18b5648cb | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  If you like cartoon animation styles, I think you’ll enjoy this one: --sref 2951117069 It’s a digita
  https://x.com/i/web/status/1997303374362894714
  prompt: --sref 2951117069
- 9d494de1-72b2-4f88-99d1-b69d8ab9f74f | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @omokage_AIsOK — Whispers in the pantry lane, hiding from the daily rain https://t.co/Q9enIgCUYz
  https://x.com/i/web/status/1996429380810428437
- 9e4e14b4-4f4a-4a4f-8263-cc79f3ec00f0 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @CHAO2U_AI — HA-P2ØPY26 https://t.co/P5C43Dhm7c
  https://x.com/i/web/status/2006415315874492741
- 4b43f28b-7dd0-4830-be7a-5d7c766d55c7 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  Today I want to share this Midjourney style reference: --sref 3660316281 Neo-Noir Graphic Style o
  https://x.com/i/web/status/1986771890921181577
  prompt: --sref 3660316281 Neo-Noir Graphic Style or Dark Comic Realism, a digital reinterpretation of 1980s horror and crime comics, featuring expressionist shading and a dark cinematic tone. An illustrated comic noir style with
- 7c82a78d-7b86-47ee-9afd-83d84b93a002 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  Good morning. ☕️☕️☕️ This SREF has a warm, friendly charm that feels straight out of a storybook. Th
  https://x.com/i/web/status/1999358560887578769
  prompt: --sref 699020693
- 5e295bcb-1f43-44e0-baff-41b761d6b006 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @mitch0z — Nano Banana knows a ton of different photography styles.
  https://x.com/i/web/status/1995939147182473331
- 974fe1a1-a561-403e-8eca-8352708dcbce | image_prompt | Prompt field is only a URL.
  @fofrAI — Character selection screen
  https://x.com/i/web/status/2003138798549655771
  prompt: https://gist.github.com/fofr/f2493272b543f62b2b3b5824f2dab30f
- e5ac10f5-1164-481e-99ac-c5349a213689 | image_prompt | Prompt field is only a URL.
  @gizakdag — Tried an effect with Nano Banana Pro.
  https://x.com/i/web/status/1996288172624634336
  prompt: https://twitter.com/gizakdag/status/1996288172624634336/photo/1
- 651ffafb-ef5b-4577-8784-615208754658 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  Today I’m bringing you a new Midjourney style reference for comic art: --sref 4060460422 It’s a mode
  https://x.com/i/web/status/1992517562362429460
  prompt: --sref 4060460422
- 94c5c2bb-d78f-4cb0-a2f9-5ad8f8f41c8c | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @craftian_keskin — An old grainy style reference.
  https://x.com/i/web/status/2000227755791679546
  prompt: --sref 4133327581
- 2a325a67-ae15-4516-bb6a-0ab78879528a | image_prompt | Prompt points to comments or another location rather than storing the actual prompt.
  @kubadesign — prompt in the comments since some of you liked the images
  https://x.com/i/web/status/1982483415690846623
  prompt: prompt in the comments since some of you liked the images
- 993c25d6-986f-4d51-99fa-732b8a0b6801 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @CarolynIott — --sref 4828059
  https://x.com/i/web/status/1991265235714601231
  prompt: --sref 4828059
- 209d47d0-1e7f-4f6e-90e4-2181c5208f6d | image_prompt | Prompt points to comments or another location rather than storing the actual prompt.
  @AmirMushich — Retexture logos in 2 minutes
  https://x.com/i/web/status/2000301364354961613
  prompt: 10 prompts below
- f8f9f8fa-f278-42c7-a1a0-5056814e78a5 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @eijo_AIart — https://t.co/6bDXhJzlZa
  https://x.com/i/web/status/1999237775615516846
- cd36839d-c00a-481d-aee1-9465ce5d3288 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @SDT_side — https://t.co/YkMcD7UTkE
  https://x.com/i/web/status/2003702090334634369
- a90f238d-3f2a-4141-b47a-b90eca4d1865 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @ElizaAtomTan — Full prompt + 500 more: https://t.co/husvlL7Zpv https://t.co/tISHI2cKuH
  https://x.com/i/web/status/2015960565647351976
- ea75e400-fc93-4518-8102-20be2a8e01e6 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @firatbilal — Another good sref for minimal illustrations and tattoo designs. Paint it blac...
  https://x.com/i/web/status/1988181975534862783
  prompt: --sref 1553364671 --sw 949 --stylize 600
- 622b9dbc-74ce-45ea-8329-2b18fbec07bb | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @omokage_AIsOK — Let the heavy wild wind blow, watching where the clouds will go https://t.co/...
  https://x.com/i/web/status/1998434499802313168
- 341f8777-4e24-4c18-87ab-c21068c0a0c7 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @CHAO2U_AI — BeReal https://t.co/D4rQNaRg3Y
  https://x.com/i/web/status/2005229674637713743
- 25abf7e3-f919-4c0d-b3e7-f9187b767e41 | image_prompt | Prompt field is only a URL.
  @iX00AI — Nano Banana Pro - 3×3 photo grid (Multi Angle Shot)
  https://x.com/i/web/status/1995130835218186540
  prompt: https://twitter.com/iX00AI/status/1995130835218186540/photo/1
- 0fa5bcc8-287f-4314-a980-7ac6d030785f | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @tomoeshi10 — 今日は、ここで少し休みましょう☀️
  https://x.com/i/web/status/1996339319238431042
- ae44fb51-12e3-4d06-a758-bed032b59a5f | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @NerdyRodent — https://t.co/doyGJzYwi6
  https://x.com/i/web/status/1819741790800367892
- a773808d-9f0b-4e96-b467-da73969db890 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @zampy68 — SFW https://t.co/lLwUtQKCsx
  https://x.com/i/web/status/1996357147333124313
- 74350182-b515-48b9-adc9-59672c7a8893 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @awesome_visuals — just spent 5000 euros on a new toy. 😉
  https://x.com/i/web/status/1992582491794993309
- f8926610-a838-4075-b5b1-bb4ef366f17c | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  🚨 I wasn’t ready for this. Nano Banana Pro + Dreamina just gave me a full creative pipeline that usu
  https://x.com/i/web/status/1992947180332838955
- 1c30c925-7dd1-4b48-85ef-6d02dffd6a07 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @94vanAI — nice work https://t.co/jV9t6Mi8Es
  https://x.com/i/web/status/1994204216127111582
- a3ed32ec-9acb-4c6c-b18e-089391061f40 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @NerdyRodent — Sleep well! https://t.co/LPOaVssnJU
  https://x.com/i/web/status/1819519424765861992
- 30b212e9-22c0-4c8f-bb42-556102a7e316 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @omokage_AIsOK — Waiting for the perfect shot, finding something we forgot https://t.co/Tb9JNq...
  https://x.com/i/web/status/1996882240362438954
- a58b032f-8c07-40b6-bd5f-78883ba97418 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @NerdyRodent — Just working on my latest piece... https://t.co/gPhkieudGE
  https://x.com/i/web/status/1819719522204406225
- 30ddeeb6-c974-4345-b762-a4f51cbeb3af | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  steal my secret viral nano banana pro slideshow prompt: FACE: - Big innocent doe eyes, that specific
  https://x.com/i/web/status/1997796651667251640
- 3554c27b-487b-439f-98bb-b758c06b127f | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @LudovicCreator — QT Something Green https://t.co/Y8W00e6G5V
  https://x.com/i/web/status/1996746344753402190
- a0349346-7b3d-47fa-b124-be50f918799b | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @NerdyRodent — Sleep well - and keep it normal!
  https://x.com/i/web/status/1813334352866246881
- bad37e5c-a6a8-429e-8ca2-0af9f2b6f6c5 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @omokage_AIsOK — Holding onto pinkish air, dancing like she doesn't care https://t.co/LUcF8t0mZH
  https://x.com/i/web/status/1997924105291727045
- de6fa24c-d6d0-43fe-8381-8945198d6f68 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @LudovicCreator — QT Something Purple https://t.co/bqXxZe5IUT
  https://x.com/i/web/status/1996233008274169968
- a1e78040-aaf7-458a-b721-0cc569ab98c9 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @asuka_aiaiai — #AIart︎ https://t.co/kESKitAZgb
  https://x.com/i/web/status/2004384213060169782
- a1dc1f9a-229b-4bf2-8ceb-9088b05fcea0 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @irohanepopuris — おはようございます🩷
  https://x.com/i/web/status/1996335979129721006
- f61b38b9-c02d-4f99-8ba1-f79d84f445ac | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @kasu_mi_ai — 最近は実車と見分けがつかないようなリアルな生成が出来るみたいですが 私はちやっぱりこういう非現実的かもしれないけどキラキラした雰囲気が好きです✨ htt...
  https://x.com/i/web/status/1997193505387827391
- f3be384f-8cb2-4483-bada-7eb48a60af07 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @qaHEqxyzUF99214 — https://t.co/3lPT1nR7EW
  https://x.com/i/web/status/1997936753316172269
- c89074c2-12f9-4d4e-aa69-94ec8172c09a | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  SREF inside Nano Banana Pro 🍌 (or the closest to it) I discovered you can actually build reusable st
  https://x.com/i/web/status/1995539505995284769
- cdee0569-681a-46b7-809f-17ba80cf090e | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  To everyone who loved the --sref I shared recently for that classic, nostalgic animation style, I th
  https://x.com/i/web/status/1992898363428114755
  prompt: --sref 2068450145
- 17b6de70-63e1-44be-b293-12658dfa45c5 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @NerdyRodent — gm!
  https://x.com/i/web/status/1819626000449224871
- ebd13ee1-53b0-46fc-a687-8a32720fc5ea | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @kasu_mi_ai — https://t.co/GAAgBGbWQm
  https://x.com/i/web/status/1999802838252388651
- 09dc4cec-637a-46dc-8f70-b938a8fcc72e | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @pom_portfolio — GM https://t.co/PLE3Y2F4Pq
  https://x.com/i/web/status/1996659573688778820
- b6e7eab7-ca62-47d9-bd41-cb55fd4cf98b | video_prompt | Prompt field is only a URL.
  @jaredliu_bravo — 链接：https://t.co/yXOlnMdUd6
  https://x.com/i/web/status/2021888419228762533
  prompt: https://youmind.com/seedance-2-0-prompts
- 522f7daa-9580-4861-89e8-dbe7ec6afb71 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @tom_doerr — Dataset for consistent identity preservation in image editing
  https://x.com/i/web/status/1996143294816915653
- 1c314d0b-e3a2-41ff-8a5c-38ef20ee98d0 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @maxescu — @minchoi I like to mess with other people's content. https://t.co/Vx2Mqz8cbJ
  https://x.com/i/web/status/1994443937637974443
- c335c7f9-b982-49cc-8786-3d213cb386a3 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @SDT_side — https://t.co/OanpWJMI4Y
  https://x.com/i/web/status/1997323594934988930
- ad78d28d-6e7b-45b6-b78b-a6ad097ce37f | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @BobSacamano2022 — z-image https://t.co/ZZKXCMXE0s
  https://x.com/i/web/status/2002470024842555531
- 86b6bd2c-4b3f-439e-b8ae-2fe027ee8e56 | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @tisch_eins — A playful caricature style with bold faces and clean retro shading. This SREF...
  https://x.com/i/web/status/1991839046641828089
  prompt: --sref 2485841502
- a0612230-e4ba-49f7-88e2-0016f13fcbcb | image_prompt | Only a bare Midjourney --sref value was captured; no additional generation context stored.
  @tisch_eins — Good morning. ☕️ Here’s a SREF with a soft retro-cinematic mood, warm light, ...
  https://x.com/i/web/status/1997184234243371362
  prompt: --sref 1685376648
- 348c5dba-2fe0-423c-86a1-44b16f5812fb | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Good morning❣️😊 地球感謝の日：12月は1年の最後の月で、その年の感謝を伝えるのに適していることと【ちきゅう(9)】の語呂合わせにちなんで青木稚華(ちはる)氏が12月9日に記念日を制定し
  https://x.com/i/web/status/1998150847143039060
- 079ea54e-02f4-4ee5-85ca-d255278cbc63 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  @369labsx — all the guides you need for ai content in 2026
  https://x.com/i/web/status/2010119102203867515
- af79e9f1-ef08-4d04-8629-08efa5c99515 | image_prompt | No prompt was extracted. May still be art, but the stored evidence is incomplete.
  Thread by Dominik Scholz (238 tweets)
  https://x.com/0xjitsu/status/2021071594697916645
