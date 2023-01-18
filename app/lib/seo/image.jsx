import { renderToString } from "react-dom/server";

export async function getShareableImage(component) {
  try {
    const svg = renderToString(component);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=60",
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to render Share Image:", component, error);

    return new Response(
      renderToString(
        <svg>
          <text>Default share image</text>
        </svg>
      ),

      {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );
  }
}
