# Netlify Functions + Prompt Engineering

Oefenproject voor het leerplan AI Freelancing.

## Wat dit project demonstreert

- Netlify Functions als veilige backend voor API calls
- Claude API integratie met verborgen API key via .env
- System prompts — Claude een vaste rol en gedrag geven
- JSON output — gestructureerde data uit vrije tekst halen
- Multi-turn chat — gespreksgeheugen over meerdere berichten

## Stack

- Netlify Functions (serverless backend)
- Claude API (Haiku model)
- Vanilla HTML/JS frontend

## Lokaal draaien

1. Clone de repo
2. Maak een `.env` bestand aan met `ANTHROPIC_API_KEY=jouw_sleutel`
3. Run `netlify dev`
4. Open `http://localhost:8888`
```

Sla op met Ctrl + S. Daarna in de terminal:
```
git add README.md
```
```
git commit -m "add README"
```
```
git push
