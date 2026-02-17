# Razorpay "Network error" when Lambda is in VPC

## Symptom

- **POST /razorpay/create-order** returns **500** with:
  - `"Network error connecting to payment gateway. Please check Lambda VPC configuration and ensure internet connectivity is available."`

## Cause

The Lambda function is attached to a **VPC** (so it can reach RDS). By default, Lambdas in a **private subnet** have **no internet access**. Outbound calls to **https://api.razorpay.com** therefore fail (timeout, ENOTFOUND, or ECONNREFUSED).

## Fix: Give Lambda outbound internet via NAT Gateway

1. **Create a NAT Gateway** (if you don’t have one):
   - In **VPC** → **NAT Gateways** → **Create NAT Gateway**.
   - Place it in a **public** subnet (one that has an Internet Gateway in its route table).
   - Allocate an Elastic IP for it.

2. **Route private subnet traffic through the NAT Gateway**:
   - Open **VPC** → **Route Tables**.
   - Select the **route table used by the Lambda’s subnet(s)** (the private subnet(s) where the Lambda runs).
   - Add a route:
     - **Destination:** `0.0.0.0/0`
     - **Target:** NAT Gateway (the one you created).

3. **Confirm Lambda’s subnets**:
   - In **Lambda** → your function → **Configuration** → **VPC**.
   - Note the subnets; ensure their route table has the `0.0.0.0/0` → NAT Gateway route above.

4. **Redeploy** is not required; the next create-order request will use the new routing.

## Quick check

- From the same VPC (e.g. a Lambda or EC2 in the same subnet), run:
  - `curl -s -o /dev/null -w "%{http_code}" https://api.razorpay.com/v1/orders`
- If you get a **401** (Unauthorized), the network path is fine; the 401 is due to no auth header. If the request times out or fails to connect, the route/NAT setup is still wrong.

## Alternative (not recommended for production)

- **Remove the Lambda from the VPC** so it uses the default (public) path to the internet. This only works if the Lambda does **not** need to reach RDS in a private subnet. If RDS is in the same VPC, you typically need the Lambda in the VPC and thus **NAT Gateway** as above.

## References

- [AWS: NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
- [Lambda in VPC](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
