terraform {
  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.0" }
    kubernetes   = { source = "hashicorp/kubernetes", version = "~> 2.0" }
    helm         = { source = "hashicorp/helm", version = "~> 2.0" }
    kubectl      = { source = "gavinbunney/kubectl", version = "~> 1.0" }
    htpasswd     = { source = "loafoe/htpasswd", version = "~> 1.0" }
  }

  cloud {
    organization = "world-of-v"
    workspaces { tags = ["wov-marketplace"] }
  }
}

provider "digitalocean" {
  token = var.digitalocean_token
}

locals {
  host                   = digitalocean_kubernetes_cluster.wov_cluster.endpoint
  token                  = digitalocean_kubernetes_cluster.wov_cluster.kube_config[0].token
  cluster_ca_certificate = base64decode(digitalocean_kubernetes_cluster.wov_cluster.kube_config[0].cluster_ca_certificate)
}

provider "kubernetes" {
  host                   = local.host
  token                  = local.token
  cluster_ca_certificate = local.cluster_ca_certificate
}

provider "kubectl" {
  host                   = local.host
  token                  = local.token
  cluster_ca_certificate = local.cluster_ca_certificate
  load_config_file       = false
}

provider "helm" {
  kubernetes {
    host                   = local.host
    token                  = local.token
    cluster_ca_certificate = local.cluster_ca_certificate
  }
}
