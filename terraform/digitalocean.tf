resource "digitalocean_kubernetes_cluster" "wov_cluster" {
  name    = "${terraform.workspace}-k8s-cluster"
  region  = var.digitalocean_region
  version = "1.24.12-do.0"

  node_pool {
    name       = "${terraform.workspace}-k8s-pool"
    size       = var.k8s_cluster_node_size
    auto_scale = true
    min_nodes  = var.k8s_cluster_node_count_min
    max_nodes  = var.k8s_cluster_node_count_max

    # Enable this on first deployment so the cluster doesn't wait a long time
    # before autoscaling.
    # node_count = var.k8s_cluster_node_count_max 
  }
}

# Add the cluster to the project.
resource "digitalocean_project_resources" "wov_resources" {
  project   = var.digitalocean_project_id
  resources = [digitalocean_kubernetes_cluster.wov_cluster.urn]
}

data "digitalocean_domain" "wov_domain" {
  name = var.wov_domain
}

data "digitalocean_domain" "metadata_domain" {
  name = var.metadata_domain
}

# Add new A records pointing to the public IP address of the ingress load balancer.
# We do it dynamically so if the infrastructure needs to be rebuilt it points the domain correctly.

resource "digitalocean_record" "wov_dns_record" {
  domain = data.digitalocean_domain.wov_domain.id
  type   = "A"
  name   = terraform.workspace
  value  = kubernetes_ingress_v1.services_ingress.status[0].load_balancer[0].ingress[0].ip
}

resource "digitalocean_record" "metadata_dns_record" {
  domain = data.digitalocean_domain.metadata_domain.id
  type   = "A"
  name   = "@"
  value  = kubernetes_ingress_v1.services_ingress.status[0].load_balancer[0].ingress[0].ip
}

resource "digitalocean_record" "grafana_dns_record" {
  domain = data.digitalocean_domain.wov_domain.id
  type   = "A"
  name   = join(".", [terraform.workspace, "grafana"])
  value  = kubernetes_ingress_v1.grafana_ingress.status[0].load_balancer[0].ingress[0].ip
}

resource "digitalocean_record" "jaeger_dns_record" {
  domain = data.digitalocean_domain.wov_domain.id
  type   = "A"
  name   = join(".", [terraform.workspace, "jaeger"])
  value  = kubernetes_ingress_v1.jaeger_ingress.status[0].load_balancer[0].ingress[0].ip
}

