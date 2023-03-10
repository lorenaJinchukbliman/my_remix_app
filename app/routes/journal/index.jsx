import { json } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { flattenConnection, Image } from "@shopify/hydrogen-react";

import { Grid, PageHeader, Section, Link } from "~/components";
import { getImageLoadingPriority, PAGINATION_SIZE } from "~/lib/const";
import { getLocaleFromRequest } from "~/lib/utils";

const BLOG_HANDLE = "Journal";

export const handle = {
  seo: {
    titleTemplate: "%s | Journal",
  },
};

export const loader = async ({ request, context: { storefront } }) => {
  const { language, country } = getLocaleFromRequest(request);
  const { blog } = await storefront.query(BLOGS_QUERY, {
    variables: {
      blogHandle: BLOG_HANDLE,
      pageBy: PAGINATION_SIZE,
      language: storefront.i18n?.language,
    },
  });

  if (!blog?.articles) {
    throw new Response("Not found", { status: 404 });
  }

  const articles = flattenConnection(blog.articles).map((article) => {
    const { publishedAt } = article;
    return {
      ...article,
      publishedAt: new Intl.DateTimeFormat(`${language}-${country}`, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(publishedAt)),
    };
  });

  return json(
    { articles },
    {
      headers: {
        // TODO cacheLong()
      },
    }
  );
};

export const meta = () => {
  return {
    title: "All Journals",
  };
};

export default function Journals() {
  const { articles } = useLoaderData();

  return (
    <>
      <PageHeader heading={BLOG_HANDLE} />
      <Section>
        <Grid as="ol" layout="blog">
          {articles.map((article, i) => (
            <ArticleCard
              blogHandle={BLOG_HANDLE.toLowerCase()}
              article={article}
              key={article.id}
              loading={getImageLoadingPriority(i, 2)}
            />
          ))}
        </Grid>
      </Section>
    </>
  );
}

function ArticleCard({ blogHandle, article, loading }) {
  return (
    <li key={article.id}>
      <Link to={`/${blogHandle}/${article.handle}`}>
        {article.image && (
          <div className="card-image aspect-[3/2]">
            <Image
              alt={article.image.altText || article.title}
              className="object-cover w-full"
              data={article.image}
              height={400}
              loading={loading}
              sizes="(min-width: 768px) 50vw, 100vw"
              width={600}
              loaderOptions={{
                scale: 2,
                crop: "center",
              }}
            />
          </div>
        )}

        <h2 className="mt-4 font-medium">{article.title}</h2>
        <span className="block mt-1">{article.publishedAt}</span>
      </Link>
    </li>
  );
}

const BLOGS_QUERY = `#graphql
query Blog(
  $language: LanguageCode
  $blogHandle: String!
  $pageBy: Int!
  $cursor: String
) @inContext(language: $language) {
  blog(handle: $blogHandle) {
    articles(first: $pageBy, after: $cursor) {
      edges {
        node {
          author: authorV2 {
            name
          }
          contentHtml
          handle
          id
          image {
            id
            altText
            url
            width
            height
          }
          publishedAt
          title
        }
      }
    }
  }
}
`;
