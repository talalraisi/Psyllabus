# Generating the bank on a rented GPU

The short version: rent by the hour, **run the self-test before anything else**,
and only start generating once it passes. The self-test costs about five minutes
and a few cents. Finding out afterwards costs a night and a bank you have to
throw away.

## Why rent rather than run locally

Ollama on a laptop serves roughly one request at a time, so the card spends most
of its life idle between calls. vLLM on a rented GPU batches dozens of requests
into the same forward pass. That is the whole difference, and it is the
difference between a question a minute and a few questions a second.

Nothing about the questions changes. Same prompts, same verification, same
schema. Only the thing answering them moves.

## 1. Rent a box

You want one card with enough memory for the model, not four small ones. A 70B
model at 8-bit needs roughly 70GB, which fits on a single 80GB card with room
for the KV cache. A 30B model fits comfortably on 48GB.

RunPod, Vast.ai and Lambda all rent by the hour. Prices move; check on the day.
Pick the cheapest region that has the card, because none of this is latency
sensitive: it is a batch job talking to a database in another country either way.

## 2. Serve a model

```bash
pip install vllm
vllm serve Qwen/Qwen2.5-72B-Instruct \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.92
```

`--max-model-len 8192` matters. The prompts here are long — a batch of twenty
questions plus forty existing stems to avoid — but nowhere near the model's
maximum. Leaving the context at its default reserves memory for a length you
never use, which costs you the concurrency that made renting worth it.

Then expose the port. An SSH tunnel from your machine is the simplest safe
option, and it means the server is never open to the internet:

```bash
ssh -N -L 8000:localhost:8000 root@YOUR_BOX_IP
```

## 3. Run the self-test — this is the gate

```bash
node scripts/verify-selftest.mjs --provider vllm \
  --vllm-model Qwen/Qwen2.5-72B-Instruct \
  --vllm-url http://localhost:8000/v1
```

Six questions. Two of them are the ones that actually got into the bank with
wrong answers, and four have known-good answers so a model that rejects
everything cannot pass by accident.

**6/6 means generate. Anything less means try another model.** `qwen2.5:14b`
scores 5/6: it rejects both bad questions but also rejects a correct centripetal
force question, because it works out 18 N where the answer is 36 N. A model that
cannot do that arithmetic cannot verify a physics bank, and no amount of prompt
work fixes it.

Reasoning-tuned models are usually the ones that pass, because arithmetic slips
are exactly what a reasoning trace catches. It costs an hour of rental to try
three of them, and that hour decides whether the other thirty are worth spending.

If the best model you can serve still fails, the honest options are: generate the
subjects that are not arithmetic-heavy locally, and verify the maths and physics
with `--verify-provider claude`. Generation is the cheap half in consequences and
the expensive half in tokens; verification is the reverse.

## 4. Find the concurrency that saturates the card

```bash
node scripts/generate-questions.mjs --provider vllm \
  --vllm-model Qwen/Qwen2.5-72B-Instruct \
  --subject "Physics SL" --per-subtopic 10 --concurrency 16 --gpu-cost 2.50
```

Every subtopic prints `tok/s`. Raise `--concurrency` until that number stops
climbing, and that is your setting. Doubling it past the point it flattens just
adds queueing.

`--gpu-cost` is what you are paying per hour, so the run prices itself and you
can compare it honestly against a paid API run.

## 5. Generate

```bash
node scripts/build-bank.mjs --all --per-subtopic 50 \
  --provider vllm --vllm-model Qwen/Qwen2.5-72B-Instruct \
  --concurrency 32
```

`--mine` instead of `--all` does only the subjects on your profile, which is
the sensible first run.

If you also have a second machine, give each one a shard so they split the list
instead of racing through the same one:

```bash
# on the box
node scripts/build-bank.mjs --all --shard 1/2 --provider vllm ...
# at home
node scripts/build-bank.mjs --all --shard 2/2 --provider vllm ...
```

Both are safe to kill. Every count comes from the database, so restarting
resumes rather than duplicating.

## What to watch overnight

- `tok/s` steady means the card is busy. Falling means something is queueing.
- The rejection lines. A subject where most questions are rejected is telling
  you the model cannot do that subject, and it is cheaper to notice at 1am than
  to read it in the morning.
- The running cost, against what you decided to spend before you started.
