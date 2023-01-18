import { Text } from "./Text";
import { Link } from "./Link";

// Renders a breadcrumb trail from a references metafield list
export function Breadcrumbs({ breadcrumbs }) {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  const breadcrumbsMarkup = breadcrumbs.map((breadcrumb, index) => {
    const isLastBreadcrumb = index === breadcrumbs.length - 1;

    return isLastBreadcrumb ? (
      <Text key={breadcrumb.id} as="span">
        {breadcrumb.title}
      </Text>
    ) : (
      <span key={breadcrumb.id}>
        <Link to={`/collections/${breadcrumb.handle}`}>{breadcrumb.title}</Link>
        <span className="px-2">/</span>
      </span>
    );
  });

  return <nav className="flex items-center">{breadcrumbsMarkup}</nav>;
}
