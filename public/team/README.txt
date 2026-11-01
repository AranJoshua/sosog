Team portraits for the About page.

1. Put each portrait in this folder (JPEG or WebP, portrait orientation about 4:5 or 3:4, at least 800 px wide, face in the upper half of the frame).
2. In src/data/about.ts, add a photo line to that person's entry, for example:
   { name: 'Laiza Kate R. Broñosa', email: '...', photo: '/team/laiza.jpg' }
3. Run npm run dev. The photo appears in that person's window with the two capiz shutters parked at the edges. Keep the face in the middle of the frame, because the outer sixth on each side sits behind the shutters.
