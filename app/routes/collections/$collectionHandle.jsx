import { json } from "@shopify/remix-oxygen";
import { RESOURCE_TYPES, notFoundMaybeRedirect } from "@shopify/hydrogen";
import { useLoaderData } from "@remix-run/react";

import { flattenConnection } from "@shopify/hydrogen-react";
import invariant from "tiny-invariant";
import {
  PageHeader,
  Section,
  Text,
  SortFilter,
  Breadcrumbs,
} from "~/components";
import { ProductGrid } from "~/components/ProductGrid";

import { PRODUCT_CARD_FRAGMENT } from "~/data";

const PAGINATION_SIZE = 48;

export const handle = {
  hydrogen: {
    resourceType: RESOURCE_TYPES.COLLECTION,
  },
};

export async function loader({ params, request, context }) {
  const { collectionHandle } = params;

  invariant(collectionHandle, "Missing collectionHandle param");

  const searchParams = new URL(request.url).searchParams;
  const knownFilters = ["cursor", "productVendor", "productType"];
  const available = "available";
  const variantOption = "variantOption";
  const { sortKey, reverse } = getSortValuesFromParam(searchParams.get("sort"));

  const filters = [];
  const appliedFilters = [];

  for (const [key, value] of searchParams.entries()) {
    if (available === key) {
      filters.push({ available: value === "true" });
      appliedFilters.push({
        label: value === "true" ? "In stock" : "Out of stock",
        urlParam: {
          key: available,
          value,
        },
      });
    } else if (knownFilters.includes(key)) {
      filters.push({ [key]: value });
      appliedFilters.push({ label: value, urlParam: { key, value } });
    } else if (key.includes(variantOption)) {
      const [name, val] = value.split(":");
      filters.push({ variantOption: { name, value: val } });
      appliedFilters.push({ label: val, urlParam: { key, value } });
    }
  }

  // Builds min and max price filter since we can't stack them separately into
  // the filters array. See price filters limitations:
  // https://shopify.dev/custom-storefronts/products-collections/filter-products#limitations
  if (searchParams.has("minPrice") || searchParams.has("maxPrice")) {
    const price = {};
    if (searchParams.has("minPrice")) {
      price.min = Number(searchParams.get("minPrice")) || 0;
      appliedFilters.push({
        label: `Min: $${price.min}`,
        urlParam: { key: "minPrice", value: searchParams.get("minPrice") },
      });
    }
    if (searchParams.has("maxPrice")) {
      price.max = Number(searchParams.get("maxPrice")) || 0;
      appliedFilters.push({
        label: `Max: $${price.max}`,
        urlParam: { key: "maxPrice", value: searchParams.get("maxPrice") },
      });
    }
    filters.push({
      price,
    });
  }

  const { collection, collections } = await context.storefront.query(
    COLLECTION_QUERY,
    {
      variables: {
        handle: collectionHandle,
        pageBy: PAGINATION_SIZE,
        filters,
        sortKey,
        reverse,
        country: context.storefront.i18n?.country,
        language: context.storefront.i18n?.language,
      },
    }
  );

  if (!collection) {
    throw await notFoundMaybeRedirect(request, context);
  }

  const collectionNodes = flattenConnection(collections);

  return json({ collection, appliedFilters, collections: collectionNodes });
}

export const meta = ({ data }) => {
  return {
    title: data?.collection?.seo?.title ?? "Collection",
    description: data?.collection?.seo?.description,
  };
};

export default function Collection() {
  const { collection, collections, appliedFilters } = useLoaderData();
  const breadcrumbs =
    collection.metafield?.references &&
    flattenConnection(collection.metafield.references)
      .reverse()
      .reduce((acc, collection) => [collection, ...acc], [collection]);

  return (
    <>
      <PageHeader heading={collection.title}>
        {collection?.description && (
          <div className="flex items-baseline justify-between w-full">
            <div>
              <Text format width="narrow" as="p" className="inline-block">
                {collection.description}
              </Text>
            </div>
          </div>
        )}

        <Breadcrumbs breadcrumbs={breadcrumbs} />
      </PageHeader>
      <Section>
        <SortFilter
          filters={collection.products.filters}
          appliedFilters={appliedFilters}
          collections={collections}
        >
          <ProductGrid
            key={collection.id}
            collection={collection}
            url={`/collections/${collection.handle}`}
            data-test="product-grid"
          />
        </SortFilter>
      </Section>
    </>
  );
}

const COLLECTION_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query CollectionDetails(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $pageBy: Int!
    $cursor: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys!
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      seo {
        description
        title
      }
      image {
        id
        url
        width
        height
        altText
      }
      metafield(namespace: "breadcrumbs", key: "parents") {
        id
        value
        references(first: 10) {
          edges {
            node {
              ... on Collection {
                id
                handle
                title
              }
            }
          }
        }
        namespace
        key
      }
      products(
        first: $pageBy,
        after: $cursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        nodes {
          ...ProductCard
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    collections(first: 100) {
      edges {
        node {
          title
          handle
        }
      }
    }
  }
`;

function getSortValuesFromParam(sortParam) {
  switch (sortParam) {
    case "price-high-low":
      return {
        sortKey: "PRICE",
        reverse: true,
      };
    case "price-low-high":
      return {
        sortKey: "PRICE",
        reverse: false,
      };
    case "best-selling":
      return {
        sortKey: "BEST_SELLING",
        reverse: false,
      };
    case "newest":
      return {
        sortKey: "CREATED",
        reverse: true,
      };
    case "featured":
      return {
        sortKey: "MANUAL",
        reverse: false,
      };
    default:
      return {
        sortKey: "RELEVANCE",
        reverse: false,
      };
  }
}
