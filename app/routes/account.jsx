import {
  Await,
  Form,
  Outlet,
  useLoaderData,
  useMatches,
  useOutlet,
} from "@remix-run/react";

import { Suspense } from "react";
import {
  Button,
  OrderCard,
  PageHeader,
  Text,
  AccountDetails,
  AccountAddressBook,
  Modal,
  ProductSwimlane,
} from "~/components";
import { FeaturedCollections } from "~/components/FeaturedCollections";
import { redirect, json, defer } from "@shopify/remix-oxygen";
import { flattenConnection } from "@shopify/hydrogen-react";
import { getCustomer } from "~/data";
import { getFeaturedData } from "./featured-products";

export async function loader({ request, context, params }) {
  const { pathname } = new URL(request.url);
  const lang = params.lang;
  const customerAccessToken = await context.session.get("customerAccessToken");
  const isAuthenticated = Boolean(customerAccessToken);
  const loginPath = lang ? `${lang}/account/login` : "/account/login";

  if (!isAuthenticated) {
    if (/\/account\/login$/.test(pathname)) {
      return json({
        isAuthenticated,
      });
    }
    return redirect(loginPath);
  }

  const customer = await getCustomer(context, {
    customerAccessToken,
    request,
  });

  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}.`
      : `Welcome to your account.`
    : "Account Details";

  const orders = flattenConnection(customer?.orders);

  return defer({
    isAuthenticated,
    customer,
    heading,
    orders,
    addresses: flattenConnection(customer.addresses),
    featuredData: getFeaturedData(context.storefront),
  });
}

export default function Authenticated() {
  const data = useLoaderData();
  const outlet = useOutlet();
  const matches = useMatches();

  // routes that export handle { renderInModal: true }
  const renderOutletInModal = matches.some((match) => {
    return match?.handle?.renderInModal;
  });

  // Public routes
  if (!data.isAuthenticated) {
    return <Outlet />;
  }

  // Authenticated routes
  if (outlet) {
    if (renderOutletInModal) {
      return (
        <>
          <Modal cancelLink="/account">
            <Outlet context={{ customer: data.customer }} />
          </Modal>
          <Account {...data} />
        </>
      );
    } else {
      return <Outlet context={{ customer: data.customer }} />;
    }
  }

  return <Account {...data} />;
}

function Account({ customer, orders, heading, addresses, featuredData }) {
  return (
    <>
      <PageHeader heading={heading}>
        <Form method="post" action="/account/logout">
          <button type="submit" className="text-primary/50">
            Sign out
          </button>
        </Form>
      </PageHeader>
      {orders && <AccountOrderHistory orders={orders} />}
      <AccountDetails customer={customer} />
      <AccountAddressBook addresses={addresses} customer={customer} />

      {!orders.length && (
        <Suspense>
          <Await
            resolve={featuredData}
            errorElement="There was a problem loading featured products."
          >
            {(data) => (
              <>
                <FeaturedCollections
                  title="Popular Collections"
                  collections={data.featuredCollections}
                />

                <ProductSwimlane products={data.featuredProducts} />
              </>
            )}
          </Await>
        </Suspense>
      )}
    </>
  );
}

function AccountOrderHistory({ orders }) {
  return (
    <div className="mt-6">
      <div className="grid w-full gap-4 p-4 py-6 md:gap-8 md:p-8 lg:p-12">
        <h2 className="font-bold text-lead">Order History</h2>
        {orders?.length ? <Orders orders={orders} /> : <EmptyOrders />}
      </div>
    </div>
  );
}

function EmptyOrders() {
  return (
    <div>
      <Text className="mb-1" size="fine" width="narrow" as="p">
        You haven&apos;t placed any orders yet.
      </Text>
      <div className="w-48">
        <Button className="text-sm mt-2 w-full" variant="secondary" to={"/"}>
          Start Shopping
        </Button>
      </div>
    </div>
  );
}

function Orders({ orders }) {
  return (
    <ul className="grid-flow-row grid gap-2 gap-y-6 md:gap-4 lg:gap-6 grid-cols-1 false  sm:grid-cols-3">
      {orders.map((order) => (
        <OrderCard order={order} key={order.id} />
      ))}
    </ul>
  );
}
