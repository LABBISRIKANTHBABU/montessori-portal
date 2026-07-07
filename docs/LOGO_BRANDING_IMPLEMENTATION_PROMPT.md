# Montessori Portal — Official Logo Integration Prompt

Use the client-supplied Montessori Golden Jubilee logo as the single group-wide logo across every school in the ERP.

## Source asset

`FINAL LOGO 2025-1.jpg.jpeg`

Do not redraw, recolor, crop, distort, regenerate, or replace the people, lettering, shield, wreath, ribbon, anniversary number, or other details in the official logo.

## Required implementation

1. Store one optimized, reusable asset in the frontend and reference it consistently.
2. Replace temporary or generic Montessori icons in the landing-page brand, login brand, sidebar brand, campus selector, and school cards.
3. Add the same logo as a centered page watermark:
   - place it behind application content;
   - use low opacity and a dark navy/grayscale treatment;
   - keep it visible but subtle;
   - ensure text, forms, tables, cards, charts and dialogs remain fully readable;
   - set `pointer-events: none` and `user-select: none`;
   - never place the watermark above interactive content.
4. Scale the watermark responsively for desktop, laptop, tablet and mobile.
5. Use the shared logo as the default for certificates, receipts, vouchers, exports and print templates when a specifically approved document logo is not configured.
6. Preserve the navy `#002147`, white `#FFFFFF`, cream `#F9E4B7` and gold visual language.
7. Add meaningful alternative text to the main visible brand logo and mark repeated decorative copies as `aria-hidden`.
8. Avoid large opaque backgrounds, excessive opacity, animation, blur, or effects that reduce performance or accessibility.
9. Hide the application-background watermark in ordinary browser print styles unless the print template intentionally includes its own official watermark.
10. Verify at desktop, tablet and mobile sizes and confirm that the logo does not block clicks, inputs, navigation, scrolling, screenshots or exports.

## Acceptance criteria

- The official logo is immediately recognizable in the main brand locations.
- Every campus uses the same group identity.
- The central watermark is subtle and dark, with no white rectangle visible against the page.
- All application text meets readable contrast.
- Forms, tables and buttons remain fully interactive.
- The logo scales without stretching or clipping.
- No unofficial substitute logo remains in primary brand locations.
