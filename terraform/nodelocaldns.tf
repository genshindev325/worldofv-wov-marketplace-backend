# Node local DNS is currently disabled as a test since sometimes the services
# can't reach the managed database server.

# data "kubectl_file_documents" "nodelocaldns" {
#   content = file("nodelocaldns.yaml")
# }

# We use a node local DNS cache to work around a DNS resolution issue.
# See https://tech.findmypast.com/k8s-dns-lookup/
# resource "kubectl_manifest" "nodelocaldns" {
#   for_each  = data.kubectl_file_documents.nodelocaldns.manifests
#   yaml_body = each.value
# }
